#!/opt/local/bin/python
#
# imagePaneData.py
#
# CGI script implementing server side functions for PRISM image tool.
#

import os
import sys
import cgi
import types
import cgitb; cgitb.enable()
import logging

import prismConfig
sys.path.append( prismConfig.MGI_PYTHONLIB )
import db
db.set_sqlServer(prismConfig.MGD_DBSERVER)
db.set_sqlDatabase(prismConfig.MGD_DBNAME)
db.set_sqlUser(prismConfig.MGI_PUBLICUSER)
db.set_sqlPassword(prismConfig.MGI_PUBLICPASSWORD)

try:
    import json
except:
    import simplejson as json

PIXELDB_LDBKEY = 19

class Handler:
    def __init__(self):
	self.go()

    def go(self):
	opts = cgi.FieldStorage()
	if opts.has_key('user'):
	    db.set_sqlUser(opts['user'].value)
	if opts.has_key('password'):
	    db.set_sqlPassword(opts['password'].value)
	if opts.has_key('jnum'):
	    jnum = opts['jnum'].value
	    self.retrieve(jnum)
	    return
	elif opts.has_key('xaction'):
	    xaction = opts['xaction'].value
	    if xaction == 'update':
		updates = opts['images'].value
		updates = json.loads(updates)
		self.update(updates)
		return
	raise RuntimeError("No action.")

    def getImagePanes(self,jnum):
	query = '''
	    SELECT 
		px.numericpart AS "pixid",
	        i._image_key, 
		i.figurelabel, 
		c.term AS "class", 
		t.term AS "type",
		p._imagepane_key,
		p.panelabel,
		p.x,
		p.y,
		p.width,
		p.height
	    FROM 
		BIB_Refs r, 
	        ACC_Accession a, 
		IMG_Image i, 
		IMG_ImagePane p,
		VOC_Term c, 
		VOC_Term t,
		ACC_Accession px
	    WHERE a.accid = '%s'
	    AND a._object_key = r._refs_key
	    AND a._logicaldb_key = 1
	    AND a._mgitype_key = 1
	    AND a.preferred = 1
	    AND a.private = 0
	    AND r._refs_key = i._refs_key
	    AND i._imageclass_key = c._term_key
	    AND i._imagetype_key  = t._term_key
	    AND p._image_key = i._image_key
	    AND i._image_key *= px._object_key
	    AND px._logicaldb_key = %d
	    ORDER BY i.figurelabel, i._image_key, p.panelabel
	    ''' % (jnum, PIXELDB_LDBKEY)
	res = []
	for r in db.sql(query,'auto'):
	    if r['x'] is None:
		r['coords'] = None
	    else:
		r['coords'] = {
		    'x' : r['x'],
		    'y' : r['y'],
		    'width' : r['width'],
		    'height' : r['height']
		    }
	    r['labelWithId'] = "%s %s" % (str(r['figurelabel']),str(r['_image_key']))
	    res.append(r)
	return res
        
    def printResult(self, success, value):
        if success:
	    x = { 'success':True, 'images' : value }
	else:
	    x = { 'success':False, 'message' : value }
	print jsonpCgiHandler(x, None);

    def doUpdates(self, updates):
	updates.insert(0, 'begin transaction')
	updates.append('commit')
	db.sql(updates,'auto')

    def update(self, updates):
	if type(updates) is not types.ListType:
	    updates = [updates]
	UPDATE_TMPLT='''
	 UPDATE IMG_ImagePane
	 SET x=%(x)s, y=%(y)s, width=%(width)s, height=%(height)s
	 WHERE _imagepane_key = %(_imagepane_key)d
	 '''
	updateSql = []
	for upd in updates:
	    if upd['coords'] is None:
		upd['coords'] = { 
		  'x':'NULL', 'y':'NULL', 'width':'NULL', 'height':'NULL' }
	    else:
		for n in ['x','y','width','height']:
		    upd['coords'][n] = str(int(round(upd['coords'][n])))
		
	    upd['coords']['_imagepane_key'] = upd['_imagepane_key']
	    updateSql.append(UPDATE_TMPLT%upd['coords'])
	try:
	    self.doUpdates(updateSql)
	except:
	    self.printResult(False, db.sql_server_msg)
	else:
	    self.printResult(True, updateSql)

    def retrieve(self, jnum):
	try:
	    r=self.getImagePanes(jnum)
	except:
	    self.printResult(False, db.sql_server_msg )
	else:
	    self.printResult(True, r)

def jsonpCgiHandler(obj, callback="callback", isEncoded=False):
    scriptTag=False
    out = []
    if callback:
        scriptTag = True
        out.append( "Content-type: text/javascript\n" )
    else:
        out.append( "Content-type: application/x-json\n" )
    out.append("\n")
    if scriptTag:
        out.append( callback+"(" )
    val = obj
    if not isEncoded:
        val = json.dumps(obj)
    out.append(val)
    if scriptTag:
        out.append(")")
    return "".join(out)

#
if __name__ == "__main__":
    Handler()
