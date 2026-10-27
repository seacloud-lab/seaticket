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
