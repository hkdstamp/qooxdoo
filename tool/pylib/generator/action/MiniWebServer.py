#!/usr/bin/env python
# -*- coding: utf-8 -*-
################################################################################
#
#  qooxdoo - the new era of web development
#
#  http://qooxdoo.org
#
#  Copyright:
#    2006-2012 1&1 Internet AG, Germany, http://www.1und1.de
#
#  License:
#    LGPL: http://www.gnu.org/licenses/lgpl.html
#    EPL: http://www.eclipse.org/org/documents/epl-v10.php
#    See the LICENSE file in the project's top-level directory for details.
#
#  Authors:
#    * Thomas Herchenroeder (thron7)
#
################################################################################

##
# Start a Mini Web Server to export applications and their libraries.
##

import sys, os, re, types, codecs, string, socket, time
import BaseHTTPServer, CGIHTTPServer

from misc import Path, filetool
from misc.NameSpace import NameSpace
from generator.action import ActionLib
from generator import Context

log_levels = {
  "debug"   : 10,
  "info"    : 20,
  "warning" : 30,
  "error"   : 40,
  "fatal"   : 50,
}
log_level = "error"

live_reload = NameSpace()

class RequestHandler(CGIHTTPServer.CGIHTTPRequestHandler):
    # idea: restrict access from 'localhost' only (parse RequestHandler.request), 
    # to prevent exposing the local file system to outsiders

    # @overridden from BaseHTTPServer
    def log_request(self, code='-', size='-'):
        if log_levels[log_level] <= log_levels['info']:
            self.log_message('"%s" %s %s', self.requestline, str(code), str(size))

    # @overridden from BaseHTTPServer
    def log_error(self, format, *args):
        if log_levels[log_level] <= log_levels['error']:
            self.log_message(format, *args)

    def do_GET(self):
        # mute error messages for favicon.ico requests
        if self.path == "/favicon.ico":
            self.send_response(404)
            self.finish()

        # support for live reload
        elif self.path == "/_lreload/sentinel.json":
            # atm, changes are signaled through the ret code
            #print "checking reload necessity"
            ret = 200 if self.check_reload() else 304  # 304=not modified
            self.send_response(ret)
            self.finish()
        elif ( hasattr(live_reload, "lreload_watcher") and 
            self.path == live_reload.app_url ):
            # insert lreload.js text into index.html
            file_path = self.translate_path(self.path)
            indexfile = codecs.open(file_path, "r", "utf-8")
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            #indexfile = self.send_head()  # sets Content-Length!
            scriptfile = codecs.open(live_reload.lreload_script, "r", "utf-8")
            out = self.wfile
            for line in indexfile:
                if "</body>" in line:
                    before, after = line.split("</body>",1)
                    out.write(before)
                    out.write('<script type="text/javascript">')
                    for line1 in scriptfile:
                        if "{{interval}}" in line1:
                            line1 = line1.replace("{{interval}}", str(live_reload.lreload_interval
                                * 1000))
                        if line1.strip():
                            out.write(line1)
                    out.write('</script>')
                    out.write("</body>")
                    out.write(after)
                else:
                    out.write(line)
            indexfile.close()
            scriptfile.close()
            self.finish()

        # normal file serving
        else:
            CGIHTTPServer.CGIHTTPRequestHandler.do_GET(self)

    def check_reload(self):
        ylist = live_reload.lreload_watcher.check(live_reload.lreload_since)
        live_reload.lreload_since = time.time()
        if ylist:
            return True
        else:
            return False

def activate_lreload(obj, jobconf, confObj, app_url):
    obj.app_url = app_url
    obj.lreload_watcher = ActionLib.Watcher(jobconf, confObj)
    obj.lreload_since = time.time()
    obj.lreload_interval = jobconf.get("watch-files/check-interval", 2)
    obj.lreload_script = jobconf.get("web-server/active-reload/client-script", None)
    assert(obj.lreload_script)
    obj.lreload_script = confObj.absPath(live_reload.lreload_script)


def get_doc_root(jobconf, confObj):
    libs = jobconf.get("library", [])
    lib_paths = []
    for lib in libs:
        lpath = confObj.absPath(lib.path)
        lpath = os.path.normcase(lpath) # for os.path.commonprefix on win32
        lib_paths.append(lpath)
    croot = os.path.dirname(os.path.commonprefix(lib_paths))
    return croot

def from_doc_root_to_app_root(jobconf, confObj, doc_root):
    japp_root = jobconf.get("compile-options/paths/app-root", "source")
    app_root = os.path.normpath(os.path.join(confObj.absPath(japp_root), 'index.html'))
    # as soon as app_root and doc_root have a drive letter, the next might fail due to capitalization
    _, _, url_path = Path.getCommonPrefix(doc_root, app_root)
    url_path = Path.posifyPath(url_path)
    return url_path


##
# Get a (presumably) free port on this machine.
# - Alert: Might run into race conditions with other programs, as finding an
#   open socket (here) and getting it (in BaseHTTPServer) are not atomic.
def search_free_port():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('',0))
    port = sock.getsockname()[1]
    sock.close()
    # maybe we should wait a bit here?!
    return port
    
def runWebServer(jobconf, confObj):
    global log_level
    console = Context.console
    owd = os.getcwdu()
    log_level = jobconf.get("web-server/log-level", "error")
    server_port = jobconf.get("web-server/server-port", False)
    if server_port in (False, 0):
        server_port = search_free_port()
    if jobconf.get("web-server/allow-remote-access", False):
        server_interface = ""
    else:
        server_interface = "localhost"

    libs = jobconf.get("library", [])
    # return if not libs
    for lib in libs:
        lib._init_from_manifest()

    doc_root = jobconf.get("web-server/document-root", "") or get_doc_root(jobconf, confObj)
    doc_root = os.path.normpath(confObj.absPath(doc_root)) # important to normpath() coz '\' vs. '/'
    app_web_path = from_doc_root_to_app_root(jobconf, confObj, doc_root)
    os.chdir(doc_root)

    server = BaseHTTPServer.HTTPServer(
        (server_interface, server_port), RequestHandler)
    console.info("Starting web server on port '%d', document root is '%s'" % (server_port, doc_root))
    if server_interface == 'localhost':
        console.info("For security reasons, connections are only allowed from 'localhost'")
    else:
        console.warn("This server allows remote file access and indexes for the document root and beneath!")
    console.info("Access your source application under 'http://localhost:%d/%s'" % (server_port, app_web_path))
    console.info("Terminate the web server with Ctrl-C")

    if jobconf.get("watch-files", None):
        activate_lreload(live_reload, jobconf, confObj, "/"+app_web_path)
    server.serve_forever()

##
# Generate a local .conf file for a specific httpd.
# Supported httpd: apache2, lighttpd, (TODO: nginx)
def generateHttpdConfig(jobconf, confObj):
    console = Context.console
    # read config
    jconf_app_namespace = jobconf.get("let/APPLICATION")
    assert jconf_app_namespace
    jconf_conf_dir = jobconf.get("web-server-config/output-dir", ".")
    jconf_conf_dir = confObj.absPath(jconf_conf_dir)
    jconf_template_dir = jobconf.get("web-server-config/template-dir")
    assert jconf_template_dir
    jconf_httpd_type = jobconf.get("web-server-config/httpd-type", "apache2")
    jconf_httpd_hosturl = jobconf.get("web-server-config/httpd-host-url", "http://localhost")

    libs = jobconf.get("library", [])
    for lib in libs:
        lib._init_from_manifest()

    config_path = os.path.join(jconf_conf_dir, jconf_httpd_type + ".conf")
    template_path = os.path.join(jconf_template_dir, "httpd." + jconf_httpd_type + ".tmpl.conf")
    alias_path = jconf_app_namespace.replace(".", "/")

    # collect config values
    value_map = {
        "APP_HTTPD_CONFIG"      : "",
        "LOCALHOST_APP_URL"     : "",
        "APP_NAMESPACE_AS_PATH" : "",
        "APP_DOCUMENT_ROOT"     : "",
    }

    value_map['APP_HTTPD_CONFIG'] = config_path

    doc_root = jobconf.get("web-server-server/document-root", "") or get_doc_root(jobconf, confObj)
    doc_root = os.path.normpath(confObj.absPath(doc_root)) # important to normpath() coz '\' vs. '/'
    value_map['APP_DOCUMENT_ROOT'] = ensure_trailing_slash(doc_root)

    app_web_path = from_doc_root_to_app_root(jobconf, confObj, doc_root)
    value_map['LOCALHOST_APP_URL'] = "/".join((jconf_httpd_hosturl, alias_path, app_web_path))

    value_map['APP_NAMESPACE_AS_PATH'] = alias_path

    # load httpd-specific template
    config_templ = filetool.read(template_path)
    # replace macros
    config_templ = string.Template(config_templ)
    config = config_templ.safe_substitute(value_map)
    # write .conf file
    console.info("Writing configuration file for '%s': '%s'" % (jconf_httpd_type, config_path))
    filetool.save(config_path, config)
    console.info("See the file's comments how to integrate it with the web server configuration")
    console.info("Then open your source application with '%s'" % value_map['LOCALHOST_APP_URL'])

def ensure_trailing_slash(s):
    if s[-1] != '/':
        return s + '/'
    else:
        return s
