from django.core.files.uploadedfile import SimpleUploadedFile
from types import SimpleNamespace

from seahub.utils.storage import delete_record_attachments_from_s3, upload_portal_background_image_file_to_s3, upload_portal_files_to_s3, upload_portal_logo_file_to_s3


def test_upload_portal_logo_file_to_s3_uses_project_path(tmp_path, monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    upload_file = SimpleUploadedFile("logo.png", b"fake-image", content_type="image/png")
    tmp_upload_file = tmp_path / "portal-logo-upload.tmp"

    monkeypatch.setattr(
        "seahub.utils.storage.gen_tmp_upload_file_path",
        lambda *_args, **_kwargs: str(tmp_upload_file),
    )

    called = {}

    def _fake_upload_file(local_path, bucket, key, ExtraArgs=None):
        called["local_path"] = local_path
        called["bucket"] = bucket
        called["key"] = key
        called["extra_args"] = ExtraArgs

    monkeypatch.setattr(
        "seahub.utils.storage.s3_client",
        SimpleNamespace(upload_file=_fake_upload_file),
    )

    file_url = upload_portal_logo_file_to_s3(project_uuid, upload_file)

    assert called["local_path"] == str(tmp_upload_file)
    assert called["key"] == f"/projects/{project_uuid}/portal/logo"
    assert called["extra_args"] == {"ContentType": "image/png"}
    assert file_url.startswith(f"/api/v1/portal/{project_uuid}/logo/?v=")
    assert not tmp_upload_file.exists()


def test_upload_portal_background_image_file_to_s3_uses_project_path(tmp_path, monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    upload_file = SimpleUploadedFile("background.png", b"fake-image", content_type="image/png")
    tmp_upload_file = tmp_path / "portal-background-image-upload.tmp"

    monkeypatch.setattr(
        "seahub.utils.storage.gen_tmp_upload_file_path",
        lambda *_args, **_kwargs: str(tmp_upload_file),
    )

    called = {}

    def _fake_upload_file(local_path, bucket, key, ExtraArgs=None):
        called["local_path"] = local_path
        called["bucket"] = bucket
        called["key"] = key
        called["extra_args"] = ExtraArgs

    monkeypatch.setattr(
        "seahub.utils.storage.s3_client",
        SimpleNamespace(upload_file=_fake_upload_file),
    )

    file_url = upload_portal_background_image_file_to_s3(project_uuid, upload_file)

    assert called["local_path"] == str(tmp_upload_file)
    assert called["key"] == f"/projects/{project_uuid}/portal/background-image"
    assert called["extra_args"] == {"ContentType": "image/png"}
    assert file_url.startswith(f"/api/v1/portal/{project_uuid}/background-image/?v=")
    assert not tmp_upload_file.exists()


def test_upload_portal_issue_files_to_s3_uses_portal_path(tmp_path, monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    old_file_url = f"/upload-file/portal/{project_uuid}/2026-08/image.png"
    tmp_upload_file = tmp_path / "portal-issue-image.png"
    tmp_upload_file.write_bytes(b"fake-image")

    monkeypatch.setattr(
        "seahub.utils.storage.gen_tmp_upload_file_path",
        lambda *_args, **_kwargs: str(tmp_upload_file),
    )
    monkeypatch.setattr("seahub.utils.storage.check_file_exists_from_s3", lambda *_args: False)

    called = {}

    def _fake_upload_file(local_path, bucket, key, ExtraArgs=None):
        called["local_path"] = local_path
        called["bucket"] = bucket
        called["key"] = key
        called["extra_args"] = ExtraArgs

    monkeypatch.setattr(
        "seahub.utils.storage.s3_client",
        SimpleNamespace(upload_file=_fake_upload_file),
    )

    new_file_urls = upload_portal_files_to_s3(project_uuid, [old_file_url], "user@example.com", "portal-issues", 12)

    new_file_url = f"/file/portal/{project_uuid}/portal/portal-issues/12/image.png"
    assert called["local_path"] == str(tmp_upload_file)
    assert called["key"] == f"/projects/{project_uuid}/portal/portal-issues/12/image.png"
    assert called["extra_args"] == {"Metadata": {"username": "user@example.com"}}
    assert new_file_urls == {new_file_url: old_file_url}
    assert not tmp_upload_file.exists()


def test_delete_portal_issue_files_from_s3_uses_portal_path(monkeypatch):
    project_uuid = "d5439489-198f-4f54-9bb2-0261dd582ea3"
    called = {}

    monkeypatch.setattr(
        "seahub.utils.storage._delete_s3_prefix",
        lambda prefix: called.update({"prefix": prefix}),
    )

    prefix = delete_record_attachments_from_s3(project_uuid, "portal-issues", 12)

    expected_prefix = f"/projects/{project_uuid}/portal/portal-issues/12/"
    assert called["prefix"] == expected_prefix
    assert prefix == expected_prefix
