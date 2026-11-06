#!/usr/bin/env python3
"""A tiny fake Infinite Campus for testing login, "Stay signed in" and silent re-login in the iOS simulator.

    python3 apps/ios/Scripts/mock_ic.py [port]        # default 8099
    # then launch a Debug build with:  -VelaMockIC http://localhost:8099 [-VelaMockStale]

Credentials: student / pw123. Session cookie JSESSIONID=good. Every request is logged to stdout.
"""
import json
import socketserver
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
ROOT = "/campus/mock"
LOGIN = f"{ROOT}/portal/students/mock.jsp"

LOGIN_HTML = """<!doctype html><html><head><meta name=viewport content="width=device-width, initial-scale=1"><style>body{background:#fff;color:#111;font-size:17px}input{font-size:16px;padding:8px;width:90%%;margin-top:4px}button{font-size:17px;padding:10px 20px}</style><title>Campus Student</title></head>
<body style="font-family:sans-serif;padding:24px"><h2>Campus Student</h2><h3>Mock District</h3>%s
<form method="post" action="%s/verify.jsp">
<p><label>Student Username:<br><input name="username" type="text" autocapitalize="none"></label></p>
<p><label>Password:<br><input name="password" type="password"></label></p>
<p><button type="submit">Log In</button></p></form></body></html>"""

COURSES = [{"terms": [{"courses": [{
    "courseName": "Mock Calculus", "courseNumber": "MC101", "sectionID": 1, "teacherDisplay": "Teacher, Mock",
    "gradingTasks": [{"progressPercent": 91.5, "progressGrade": "A"}]}]}]}]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"{self.command} {self.path} cookie={self.headers.get('Cookie', '')!r}", flush=True)

    def authed(self):
        return "JSESSIONID=good" in (self.headers.get("Cookie") or "")

    def send(self, status, body=b"", ctype="text/html", headers=()):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in headers:
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, to, headers=()):
        self.send(302, headers=[("Location", to), *headers])

    def do_HEAD(self):
        self.send(200)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == LOGIN:
            return self.send(200, (LOGIN_HTML % ("", ROOT)).encode())
        if path.startswith(f"{ROOT}/nav-wrapper"):
            if not self.authed():
                return self.redirect(LOGIN)
            return self.send(200, b"<html><body><h2>Portal</h2><p>Signed in.</p></body></html>")
        if path.startswith(f"{ROOT}/prism/api/") or path.startswith(f"{ROOT}/resources/") or path.startswith(f"{ROOT}/api/"):
            if not self.authed():
                return self.redirect(LOGIN)  # like real IC: HTML login page instead of a 401
            if path.endswith("/portal/person"):
                return self.send(200, json.dumps({"data": [{"personID": 1, "firstName": "Mock", "lastName": "Student"}]}).encode(), "application/json")
            if path.endswith("/portal/grades"):
                return self.send(200, json.dumps(COURSES).encode(), "application/json")
            return self.send(404, b"{}", "application/json")
        self.send(404, b"not found")

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        form = parse_qs(self.rfile.read(length).decode())
        if self.path.split("?")[0] == f"{ROOT}/verify.jsp":
            if form.get("username") == ["student"] and form.get("password") == ["pw123"]:
                return self.redirect(f"{ROOT}/nav-wrapper/student", [("Set-Cookie", "JSESSIONID=good; Path=/")])
            err = "<p style='color:red'>Invalid username and/or password</p>"
            return self.send(200, (LOGIN_HTML % (err, ROOT)).encode())
        self.send(404, b"not found")


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def server_bind(self):
        # HTTPServer's default does a reverse-DNS getfqdn() here, which can stall for many seconds
        # on some networks while the socket is bound but not yet listening.
        socketserver.TCPServer.server_bind(self)
        self.server_name, self.server_port = "localhost", PORT


if __name__ == "__main__":
    print(f"mock IC on http://localhost:{PORT}{ROOT}  (student / pw123)", flush=True)
    Server(("127.0.0.1", PORT), Handler).serve_forever()
