from django.urls import path, re_path
from . import views, apis

urlpatterns = [
    path('', views.billing, name='billing'),
    re_path(r'^api/organizations/(?P<org_id>\d+)/$',
            apis.BillingOrganizationOperation.as_view(),
            name='billing-api-organization-operation'),
    re_path(r'^api/organizations/(?P<org_id>\d+)/additional-credits/$',
            apis.BillingOrganizationAdditionalCredits.as_view(),
            name='billing-api-organization-additional-credits'),
]
