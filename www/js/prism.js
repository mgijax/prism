Ext.namespace('PRISM');

PRISM.init = function(cfg){
    Ext.QuickTips.init();
    Ext.apply(Ext.QuickTips.getQuickTip(), {
	showDelay: 2000
    });

    v = new Ext.Viewport({layout:'fit'});
    w = new PRISM.Editor();
    v.add(w);
    w.show()
    w.openLogin()
    w.setJnum('J:58080')
    // other good examples: J:58080, J:172713, J:168626, J:102528, 
    // J:93300, J:30342, J:47700, J:64590, J:42707, J:12604
}
