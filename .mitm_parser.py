
import requests

server_url = "http://localhost:8686/mitmparse"

def response(flow):
    data = {
        "host": flow.request.host,
        "method": flow.request.method,
        "path": flow.request.path,
        "url": flow.request.pretty_url,
        "request_headers": dict(flow.request.headers),
        "status_code": flow.response.status_code,
        "response_headers": dict(flow.response.headers),
        "request_content": flow.request.get_text(),
        "response_content": flow.response.get_text()
    }

    requests.post(server_url, json=data)
