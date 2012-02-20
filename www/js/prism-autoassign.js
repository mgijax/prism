Ext.namespace('PRISM');

PRISM.AutoAssigner = Ext.extend(Object, {
    editor : undefined,
    enabled : false,
    constructor : function(cfg){
	Ext.apply(this, cfg||{});
	if(!this.editor) throw new Error("No editor.");
    },
    isEnabled : function(){
        return this.enabled;
    },
    setEnabled : function(b){
        this.enabled=b;
	if(b) this.reset();
    },
    reset : function(){} // OVERRIDE ME
});

PRISM.OnePaneAssigner = Ext.extend(PRISM.AutoAssigner, {
    reset : function(){
	var e = this.editor;
	var r;
	e.removeRegions();
	r = e.createCoveringRegion();
	e.getCurrentPanes().each(function(p){this.associate(p,r);},e);
    }
});

PRISM.ClickAutoAssigner = Ext.extend(PRISM.AutoAssigner, {
    constructor : function(cfg){
	PRISM.ClickAutoAssigner.superclass.constructor.call(this,cfg);
	this.enabled = false;
	this.sm = this.editor.grid.getSelectionModel();
	this.store = this.editor.grid.getStore();
	this.enabled = false;
    },
    click : function(r){
	if(! this.enabled) return;
	var p = this.sm.getSelected();
	var e = this.editor;
	if(!p) p = e.currPanes.get(0);
	var i = this.store.indexOf(p) + 1;
	if( i > e.currPanesRange[1] )
	    i = e.currPanesRange[0];
	e.pushState();
	e.associate(p,r);
	this.sm.selectRow( i );
    },
});

PRISM.GridAutoAssigner = Ext.extend(PRISM.AutoAssigner, {
    reset : function(){
	var rs = this.editor.getRegions();
	var cps = this.editor.getCurrentPanes();
	rs.sort(function(r1,r2){
	    var xy1 = r1.getPosition();
	    var xy2 = r2.getPosition();
	    if(xy1[1] < xy2[1])
		return -1;
	    else if(xy1[1] > xy2[1])
	        return 1;
	    else if (xy1[0] < xy2[0])
	        return -1;
	    else if (xy1[0] > xy2[0])
	        return 1;
	    else
		return 0;
	    });
	cps.each( function(p,i){
	    if(i >= rs.length) return false;
	    this.editor.associate(p, rs[i]);
	    }, this);
    }
});
