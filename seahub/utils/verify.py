import random


def get_random_code(length=6, only_number=True):
    if only_number:
        alphabet = list("0123456789")
    else:
        alphabet = list("23456789abcdefghijkmnopqrstuvwxyz")
    return ''.join([random.choice(alphabet) for _ in range(length)])
