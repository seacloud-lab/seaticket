import os
import logging
from email.utils import formataddr, parseaddr
from django.conf import settings
from django.template import loader
from django.core.mail import EmailMessage

from seahub.utils import get_site_scheme_and_netloc, get_site_name
from seahub.settings import MEDIA_URL, LOGO_PATH, \
        MEDIA_ROOT, CUSTOM_LOGO_PATH

logger = logging.getLogger(__name__)


def send_html_email_with_dj_template(recipients, subject, dj_template, context=None, sender_name=None):
    """

    Arguments:
    - `recipients`:
    - `subject`:
    - `dj_template`:
    - `context`:
    - `sender_name`: optional display name for the configured sender address.

    """

    # get logo path
    logo_path = LOGO_PATH
    custom_logo_file = os.path.join(MEDIA_ROOT, CUSTOM_LOGO_PATH)
    if os.path.exists(custom_logo_file):
        logo_path = CUSTOM_LOGO_PATH

    base_context = {
        'url_base': get_site_scheme_and_netloc(),
        'site_name': get_site_name(),
        'media_url': MEDIA_URL,
        'logo_path': logo_path,
    }
    if not context:
        context = base_context
    else:
        context.update(base_context)
    t = loader.get_template(dj_template)
    html_message = t.render(context)

    from_email = None
    if sender_name:
        sender_email = parseaddr(settings.DEFAULT_FROM_EMAIL)[1]
        if sender_email:
            from_email = formataddr((sender_name, sender_email), charset='utf-8')

    mail = EmailMessage(subject=subject, body=html_message, from_email=from_email, to=[recipients])
    mail.content_subtype = "html"

    try:
        mail.send()
        return True
    except Exception as e:
        logger.error(e)
        return False
