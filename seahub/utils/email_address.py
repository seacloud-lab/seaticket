from email.utils import parseaddr


def normalize_email_domain(address):
    """Convert an internationalized email domain to its IDNA ASCII form."""
    local_part, separator, domain = address.rpartition('@')
    if not separator:
        return address

    try:
        ascii_domain = domain.encode('idna').decode('ascii')
    except UnicodeError:
        return address
    return f'{local_part}@{ascii_domain}'


def get_email_domain(address_text):
    if not isinstance(address_text, str):
        return None
    address = parseaddr(address_text)[1] or address_text
    _, separator, domain = address.rpartition('@')
    return domain.strip().lower() if separator and domain.strip() else None
