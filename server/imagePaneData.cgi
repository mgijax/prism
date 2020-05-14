#!/bin/csh -f
#
# imagePaneData.cgi
#
# Wrapper script for invoking imagePaneData CGI service.
#
setenv HOME "/tmp"
source ../Configuration
${PYTHON} imagePaneData.py
