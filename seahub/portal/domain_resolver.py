from types import SimpleNamespace

from seahub.portal.models import PortalCustomDomain, PortalDomainAlias


PORTAL_DOMAIN_TYPE_SERVICE_ALIAS = 'service_alias'
PORTAL_DOMAIN_TYPE_CUSTOM = 'custom'


def resolve_portal_domain(host):
    alias = PortalDomainAlias.objects.get_by_host(host)
    if alias and alias.enabled:
        return SimpleNamespace(
            domain_type=PORTAL_DOMAIN_TYPE_SERVICE_ALIAS,
            domain=getattr(alias, 'domain', host),
            project_uuid=alias.project_uuid,
            binding=alias,
        )

    custom_domain = PortalCustomDomain.objects.get_by_domain(host)
    if custom_domain and custom_domain.verified:
        return SimpleNamespace(
            domain_type=PORTAL_DOMAIN_TYPE_CUSTOM,
            domain=custom_domain.domain,
            project_uuid=custom_domain.project_uuid,
            binding=custom_domain,
        )

    return None
