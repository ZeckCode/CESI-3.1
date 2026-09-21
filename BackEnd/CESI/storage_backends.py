from django.conf import settings
from django.core.files.storage import default_storage
from storages.backends.s3boto3 import S3Boto3Storage


class PublicMediaStorage(S3Boto3Storage):
    default_acl = "public-read"
    file_overwrite = False
    querystring_auth = False


class PrivateMediaStorage(S3Boto3Storage):
    default_acl = "private"
    file_overwrite = False
    querystring_auth = True


def get_public_storage():
    if getattr(settings, "USE_SPACES", False):
        return PublicMediaStorage()
    return default_storage


def get_private_storage():
    if getattr(settings, "USE_SPACES", False):
        return PrivateMediaStorage()
    return default_storage
