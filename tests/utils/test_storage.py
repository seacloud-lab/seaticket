from django.core.files.uploadedfile import SimpleUploadedFile

from seahub.utils.storage import upload_portal_logo_file_to_s3


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

    monkeypatch.setattr("seahub.utils.storage.s3_client.upload_file", _fake_upload_file)

    file_url = upload_portal_logo_file_to_s3(project_uuid, upload_file)

    assert called["local_path"] == str(tmp_upload_file)
    assert called["key"] == f"/projects/{project_uuid}/attachments/portal-logo/logo"
    assert called["extra_args"] == {"ContentType": "image/png"}
    assert file_url.startswith(f"/api/v1/portal/{project_uuid}/logo/?v=")
    assert not tmp_upload_file.exists()
