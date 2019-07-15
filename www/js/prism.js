Ext.namespace('PRISM');

PRISM.init = function(cfg){
    Ext.QuickTips.init();
    Ext.apply(Ext.QuickTips.getQuickTip(), {
	showDelay: 2000
    });

    v = new Ext.Viewport({layout:'fit'});
    w = new PRISM.Editor({
	    title : 'PRISM: PRoduction (nee PRototype) Image Submission Module [' +
		PRISM.config.PG_DBSERVER + '.' + PRISM.config.PG_DBNAME + ']'
	    });
    v.add(w);
    w.show()
    w.openLogin()
    // Allow starting J# to be specified in the hash part of the URL, like so:
    //    http://bheidev01.jax.org/prism/#J:42707
    // The "J:" is required.
    var initialJnum
    var h = window.location.hash
    if (h) {
	initialJnum = h.substring(1).trim()
	window.location.hash = ''
    }   
    // other good examples: J:58080, J:172713, J:168626, J:102528,
    // J:93300, J:30342, J:47700, J:64590, J:42707, J:12604
    w.setJnum(initialJnum || 'J:47700')
}
