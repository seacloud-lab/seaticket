import json
import os
import uuid
from io import BytesIO
from types import SimpleNamespace

from seahub.utils.storage import (
    delete_record_attachments,
    get_attachment_file_response,
    upload_portal_background_image_file,
    upload_portal_files,
    upload_portal_logo_file,
    upload_file_to_tmp_dir,
)
from django.core.files.uploadedfile import SimpleUploadedFile


def test_tmp_upload_uses_unique_name_and_preserves_extension(tmp_path, monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    monkeypatch.setattr(
        "seahub.utils.storage._resolve_tmp_upload_path",
        lambda _project_uuid, file_path: (str(tmp_path), str(tmp_path / file_path)),
    )

    first_path = upload_file_to_tmp_dir(
        project_uuid,
        SimpleUploadedFile("same-name.png", b"first", content_type="image/png"),
    )
    second_path = upload_file_to_tmp_dir(
        project_uuid,
        SimpleUploadedFile("same-name.png", b"second", content_type="image/png"),
    )

    assert first_path != second_path
    assert first_path.endswith(".png")
    assert second_path.endswith(".png")
    uuid.UUID(os.path.splitext(os.path.basename(first_path))[0])
    uuid.UUID(os.path.splitext(os.path.basename(second_path))[0])
    with open(first_path, "rb") as first_file, open(second_path, "rb") as second_file:
        assert first_file.read() == b"first"
        assert second_file.read() == b"second"


def test_upload_portal_logo_file_uses_project_path(tmp_path, monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    upload_file = SimpleUploadedFile("logo.png", b"fake-image", content_type="image/png")
    tmp_upload_file = tmp_path / "portal-logo-upload.tmp"

    monkeypatch.setattr(
        "seahub.utils.storage.gen_tmp_upload_file_path",
        lambda *_args, **_kwargs: str(tmp_upload_file),
    )

    called = {}
    published = []

    def _fake_upload_file(namespace, local_path, key, extra_args=None):
        called.update(namespace=namespace, local_path=local_path, key=key, extra_args=extra_args)

    monkeypatch.setattr("seahub.utils.storage.get_backend", lambda: SimpleNamespace(upload_file_by_path=_fake_upload_file))
    monkeypatch.setattr(
        "seahub.utils.storage.mq",
        SimpleNamespace(publish=lambda channel, payload: published.append((channel, payload))),
    )

    file_url = upload_portal_logo_file(project_uuid, upload_file)

    assert called["local_path"] == str(tmp_upload_file)
    assert called["namespace"] == 'project_attachments'
    assert called["key"] == f"/projects/{project_uuid}/portal/logo"
    assert called["extra_args"] == {"ContentType": "image/png"}
    assert published == [(
        'project_storage_update',
        json.dumps({'project_uuid': project_uuid.replace('-', '')}),
    )]
    assert file_url.startswith(f"/api/v1/portal/{project_uuid}/logo/?v=")
    assert not tmp_upload_file.exists()


def test_upload_portal_background_image_file_uses_project_path(tmp_path, monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    upload_file = SimpleUploadedFile("background.png", b"fake-image", content_type="image/png")
    tmp_upload_file = tmp_path / "portal-background-image-upload.tmp"

    monkeypatch.setattr(
        "seahub.utils.storage.gen_tmp_upload_file_path",
        lambda *_args, **_kwargs: str(tmp_upload_file),
    )

    called = {}

    def _fake_upload_file(namespace, local_path, key, extra_args=None):
        called.update(namespace=namespace, local_path=local_path, key=key, extra_args=extra_args)

    monkeypatch.setattr("seahub.utils.storage.get_backend", lambda: SimpleNamespace(upload_file_by_path=_fake_upload_file))

    file_url = upload_portal_background_image_file(project_uuid, upload_file)

    assert called["local_path"] == str(tmp_upload_file)
    assert called["key"] == f"/projects/{project_uuid}/portal/background-image"
    assert called["extra_args"] == {"ContentType": "image/png"}
    assert file_url.startswith(f"/api/v1/portal/{project_uuid}/background-image/?v=")
    assert not tmp_upload_file.exists()


def test_upload_portal_issue_files_uses_portal_path(tmp_path, monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    old_file_url = f"/upload-file/portal/{project_uuid}/2026-08/image.png"
    tmp_upload_file = tmp_path / "portal-issue-image.png"
    tmp_upload_file.write_bytes(b"fake-image")

    monkeypatch.setattr(
        "seahub.utils.storage.gen_tmp_upload_file_path",
        lambda *_args, **_kwargs: str(tmp_upload_file),
    )
    monkeypatch.setattr("seahub.utils.storage.check_file_exists", lambda *_args: False)

    called = {}

    def _fake_upload_file(namespace, local_path, key, extra_args=None):
        called.update(namespace=namespace, local_path=local_path, key=key, extra_args=extra_args)

    monkeypatch.setattr("seahub.utils.storage.get_backend", lambda: SimpleNamespace(upload_file_by_path=_fake_upload_file))

    new_file_urls = upload_portal_files(project_uuid, [old_file_url], "user@example.com", "portal-issues", 12)

    new_file_url = f"/file/portal/{project_uuid}/portal/portal-issues/12/image.png"
    assert called["local_path"] == str(tmp_upload_file)
    assert called["key"] == f"/projects/{project_uuid}/portal/portal-issues/12/image.png"
    assert called["extra_args"] == {"Metadata": {"username": "user@example.com"}}
    assert new_file_urls == {new_file_url: old_file_url}
    assert not tmp_upload_file.exists()


def test_delete_portal_issue_files_uses_portal_path(monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    called = {}

    monkeypatch.setattr(
        "seahub.utils.storage.get_backend",
        lambda: SimpleNamespace(delete_files_by_prefix=lambda namespace, prefix: called.update(namespace=namespace, prefix=prefix)),
    )

    prefix = delete_record_attachments(project_uuid, "portal-issues", 12)

    expected_prefix = f"/projects/{project_uuid}/portal/portal-issues/12/"
    assert called["namespace"] == 'project_attachments'
    assert called["prefix"] == expected_prefix
    assert prefix == expected_prefix


def test_attachment_response_forces_active_content_to_download():
    for file_path, content_type in (
        ('attachment.html', 'text/html'),
        ('attachment.svg', 'image/svg+xml'),
    ):
        response = get_attachment_file_response(
            BytesIO(b'<script>unsafe()</script>'), file_path,
            content_type=content_type,
        )
        assert response['Content-Type'] == 'application/octet-stream'
        assert response['Content-Disposition'].startswith('attachment;')
        assert response['X-Content-Type-Options'] == 'nosniff'


def test_attachment_response_forces_unknown_extension_active_mime_to_download():
    response = get_attachment_file_response(
        BytesIO(b'<script>unsafe()</script>'), 'attachment.bin',
        content_type='text/html',
    )

    assert response['Content-Type'] == 'application/octet-stream'
    assert response['Content-Disposition'].startswith('attachment;')
    assert response['X-Content-Type-Options'] == 'nosniff'


def test_attachment_response_keeps_raster_preview_inline():
    response = get_attachment_file_response(
        BytesIO(b'png'), 'thumbnail.png', content_type='image/png'
    )

    assert response['Content-Type'] == 'image/png'
    assert 'Content-Disposition' not in response
    assert response['X-Content-Type-Options'] == 'nosniff'


def test_attachment_response_uses_requested_download_filename():
    response = get_attachment_file_response(
        BytesIO(b'file contents'),
        'attachments/ticket/12/4f9b8a.zip',
        force_download=True,
        download_filename='report.zip',
    )

    assert response['Content-Disposition'] == 'attachment; filename="report.zip"'


def test_attachment_response_sanitizes_requested_download_filename():
    response = get_attachment_file_response(
        BytesIO(b'file contents'),
        'attachments/ticket/12/4f9b8a.zip',
        force_download=True,
        download_filename='../../report\r\n.zip',
    )

    assert response['Content-Disposition'] == 'attachment; filename="report.zip"'


def test_attachment_response_ignores_requested_filename_for_inline_preview():
    response = get_attachment_file_response(
        BytesIO(b'png'),
        'attachments/ticket/12/4f9b8a.png',
        content_type='image/png',
        download_filename='report.png',
    )

    assert response['Content-Type'] == 'image/png'
    assert 'Content-Disposition' not in response


def test_attachment_response_does_not_trust_uploaded_mime_for_active_extension():
    response = get_attachment_file_response(
        BytesIO(b'<script>unsafe()</script>'),
        'attachment.html',
        content_type='image/png',
    )

    assert response['Content-Type'] == 'application/octet-stream'
    assert response['Content-Disposition'].startswith('attachment;')


def test_attachment_response_does_not_trust_image_mime_for_unknown_extension():
    response = get_attachment_file_response(
        BytesIO(b'<script>unsafe()</script>'),
        'attachment.bin',
        content_type='image/png',
    )

    assert response['Content-Type'] == 'application/octet-stream'
    assert response['Content-Disposition'].startswith('attachment;')


def test_attachment_response_does_not_trust_mime_for_active_extension():
    response = get_attachment_file_response(
        BytesIO(b'<script>unsafe()</script>'),
        'attachment.html',
        content_type='image/png',
    )

    assert response['Content-Type'] == 'application/octet-stream'
    assert response['Content-Disposition'].startswith('attachment;')


def test_extensionless_file_uses_safe_stored_image_mime_for_inline_preview():
    image_response = get_attachment_file_response(
        BytesIO(b'image'), 'portal/logo', content_type='image/png'
    )
    html_response = get_attachment_file_response(
        BytesIO(b'<script>unsafe()</script>'),
        'portal/logo',
        content_type='text/html',
    )

    assert image_response['Content-Type'] == 'image/png'
    assert 'Content-Disposition' not in image_response
    assert html_response['Content-Type'] == 'application/octet-stream'
    assert html_response['Content-Disposition'].startswith('attachment;')
