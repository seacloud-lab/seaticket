# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
from django.http import HttpResponse, HttpResponseBadRequest, \
    HttpResponseRedirect, Http404
from django.views.decorators.http import require_POST
from django.contrib import messages
from django.utils.translation import gettext as _

from seahub.auth.decorators import login_required
from seahub.options.models import UserOptions
from seahub.settings import SITE_ROOT

