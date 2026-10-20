import pytest

from seahub.portal.custom_domain import normalize_portal_custom_domain, normalize_portal_subdomain_prefix


@pytest.mark.parametrize('value', [123, 0, False, [], {}, ['example.com']])
@pytest.mark.parametrize('normalize', [normalize_portal_custom_domain, normalize_portal_subdomain_prefix])
def test_domain_normalizers_reject_non_string_values(value, normalize):
    with pytest.raises(ValueError, match='is invalid'):
        normalize(value)


@pytest.mark.parametrize('value', ['', None, '   '])
@pytest.mark.parametrize('normalize', [normalize_portal_custom_domain, normalize_portal_subdomain_prefix])
def test_domain_normalizers_preserve_empty_reset(value, normalize):
    assert normalize(value) == ''


@pytest.mark.parametrize('domain', ['foo\n.bar.com', 'foo\r.bar.com', 'foo\t.bar.com'])
def test_custom_domain_rejects_control_characters_in_labels(domain):
    with pytest.raises(ValueError, match='is invalid'):
        normalize_portal_custom_domain(domain, check_reserved=False)


@pytest.mark.parametrize('domain, expected', [
    (' Support.Example.Com. ', 'support.example.com'),
    ('foo-bar.example.com', 'foo-bar.example.com'),
    ('例子.example.com', 'xn--fsqu00a.example.com'),
    ('xn--fsqu00a.example.com', 'xn--fsqu00a.example.com'),
])
def test_custom_domain_preserves_supported_normalization(domain, expected):
    assert normalize_portal_custom_domain(domain, check_reserved=False) == expected


@pytest.mark.parametrize('normalize', [normalize_portal_custom_domain, normalize_portal_subdomain_prefix])
def test_invalid_idna_is_a_validation_error_without_error_log(normalize, caplog):
    with pytest.raises(ValueError, match='is invalid'):
        normalize('\ud800.example.com')

    assert not caplog.records
