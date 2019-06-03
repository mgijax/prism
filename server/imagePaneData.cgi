#!/bin/csh -f
#
# imagePaneData.cgi
#
# Wrapper script for invoking imagePaneData CGI service.
#
setenv HOME "/tmp"
source ../Configuration

setenv PYTHONINCLUDE "/opt/python2.7/include"
setenv PYTHONLIB "/opt/python2.7/lib"
setenv PYTHONPATH "/opt/python2.7/lib:/usr/local/mgi/live/lib/python"
setenv PYTHON "/opt/python2.7/bin/python"
setenv LD_LIBRARY_PATH "/usr/lib:/usr/local/lib:/usr/local/pgsql/lib:/opt/python2.7/lib/python2.7/site-packages"

${PYTHON} imagePaneData.py
