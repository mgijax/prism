Ext.namespace('PRISM.plugins');

// Keeps a window from being moved off (or partially off) the screen.
// I.e., keeps the window's toolbar where you can get at it.
PRISM.plugins.WindowCorraler = Ext.extend(Object, {
    init : function(win){
        win.on('move', function(w,x,y){
	    if(x<0||y<0) w.setPosition(Math.max(x,0),Math.max(y,0)); 
	    });
    }
});

