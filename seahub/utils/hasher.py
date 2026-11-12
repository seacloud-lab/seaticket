# Copyright (c) 2012-2016 Seafile Ltd.
import base64
import hashlib

try:
    from Crypto.Cipher import AES
    from Crypto.Random import get_random_bytes
except ImportError:
    AES = None
    get_random_bytes = None

from django.conf import settings
from django.utils.encoding import force_str


class AESPasswordDecodeError(Exception):
    pass


BLOCK_SIZE = 32
PADDING = '{'


class AESPasswordHasher:
    algorithm = 'aes-gcm'
    legacy_algorithm = 'aes'

    def __init__(self, secret=None):
        if not secret:
            secret = settings.SECRET_KEY[:BLOCK_SIZE]
        self.secret = secret.encode('utf-8')
        self.key = hashlib.sha256(self.secret).digest()

    def encode(self, password):
        password = force_str(password).encode('utf-8')
        nonce = get_random_bytes(12)
        cipher = AES.new(self.key, AES.MODE_GCM, nonce=nonce)
        ciphertext, tag = cipher.encrypt_and_digest(password)
        parts = (nonce, tag, ciphertext)
        data = '$'.join(base64.b64encode(part).decode('ascii') for part in parts)
        return "%s$%s" % (self.algorithm, data)

    def verify(self, password, encoded):
        return self.decode(encoded) == password

    def decode(self, encoded):
        try:
            algorithm, data = encoded.split('$', 1)
            if algorithm == self.algorithm:
                nonce, tag, ciphertext = (
                    base64.b64decode(part) for part in data.split('$')
                )
                cipher = AES.new(self.key, AES.MODE_GCM, nonce=nonce)
                return cipher.decrypt_and_verify(ciphertext, tag).decode('utf-8')
            if algorithm == self.legacy_algorithm:
                cipher = AES.new(self.secret, AES.MODE_ECB)
                plaintext = cipher.decrypt(base64.b64decode(data))
                return plaintext.decode('utf-8').rstrip(PADDING)
        except (ValueError, TypeError, UnicodeDecodeError) as error:
            raise AESPasswordDecodeError from error

        raise AESPasswordDecodeError
