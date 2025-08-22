import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from seahub.settings import SEAQA_INDEXER_SERVER_URL

@csrf_exempt
def github_webhook(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    connection_id = request.GET.get('connection-id')
    url = f"{SEAQA_INDEXER_SERVER_URL}/webhook/github/"

    try:
        resp = requests.post(
            url,
            params={'connection_id': connection_id},
            data=request.body,
            headers=request.headers
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        print(e)
        return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({
        'status_code': resp.status_code,
        'response': resp.text
    }, status=200)

