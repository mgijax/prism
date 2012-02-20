Ext.namespace('PRISM');

PRISM.Region = Ext.extend(Ext.BoxComponent, {
    autoEl : {
	tag : 'div',
	cls : 'prism-region',
	children : [
	{tag:'span',cls:'prism-region-label'},
	//{tag:'div', cls:'prism-region-handle prism-north'},
	//{tag:'div', cls:'prism-region-handle prism-south'},
	//{tag:'div', cls:'prism-region-handle prism-east'},
	//{tag:'div', cls:'prism-region-handle prism-west'},
	]
    },
    selectedCls : 'selected',
    selected : false,
    label : "",
    constructor : function(cfg){
	PRISM.Region.superclass.constructor.call(this, cfg);
	if(!this.editor) 
	    throw new Error("No editor.");
	var m = this.editor.getMagnification();
	this.actualGeom = { 
	    x : this.x / m,
	    y : this.y / m,
	    width : this.width / m,
	    height : this.height / m
	    };
	this.on('render', function(r){
	    this.setSelected(this.isSelected());
	    this.setLabel( this.label );
	    }, this);
    },

    getState : function(){
	var p = this.getPosition(true);
	var s = this.getSize();
	var state = { 
	    label:this.getLabel(), 
	    x:p[0], 
	    y:p[1], 
	    width:s.width, 
	    height:s.height, 
	    selected:this.isSelected() 
	    };
	return state;
    },

    getLabel : function(){
	return this.el.child('span',true).innerHTML;
    },

    setLabel : function(l){
	this.el.child('span',true).innerHTML = l;
    },

    getActualGeometry : function(){
	return Ext.apply({}, this.actualGeom);
    },

    getActualSize : function(){
	var ag = this.actualGeometry; 
	return { width : ag.width, height : ag.height };
    },

    getActualPosition : function(){
	var ag = this.actualGeometry;
	return [ag.x, ag.y];
    },

    /**
     * Resets my size and position based on current magnification.
     */
    syncGeometry : function(){
	var m = this.editor.getMagnification();
	var g = this.actualGeom;
	this.setPosition( g.x * m, g.y * m );
	this.setSize( g.width * m, g.height * m );
    },

    /** 
     * Returns true iff I am currently selected.
     */
    isSelected : function(){
	return this.selected;
    },

    /**
     * With no args, sets my selection state to true. With a
     * boolean arg, sets it to that value.
     */
    setSelected : function(value){
	this.selected = (value || value===undefined) ? true : false;
	if(this.selected)
	    this.el && this.el.addClass(this.selectedCls);
	else
	    this.el && this.el.removeClass(this.selectedCls);
    },

    /**
     * Invert my current selection state.
     */
    toggleSelected : function(){
	this.setSelected( ! this.isSelected());
    },

    moveTo : function( x, y ){
	var m = this.editor.getMagnification();
	this.actualGeom.x = x/m;
	this.actualGeom.y = y/m;
	this.setPosition( x, y );
    },

    /**
     * Cuts me in two, either horizontally or vertically, at a specified
     * point. Returns the new region.
     * If the point is outside my coordinate range, nothing happens, and null
     * is returned.
     * Args:
     *    point		An x,y coordinate pair (e.g., mouseclick coords)
     *    orientation 	Either 'v' or 'h'.
     * Returns:
     *    A new Region, or null.
     */
    split : function( point, orientation ) {
	var c;
	var loc = this.getPosition(true);
	var sz = this.getSize();
	var cfg = {};
	var r;
	var m = this.editor.getMagnification();
	var x;
	if(orientation === 'v'){
	    // split around vertical line at x
	    c = point[0];
	    if( c<=loc[0] || c>=loc[0]+sz.width )
		return null;
	    cfg.x = c;
	    cfg.y = loc[1];
	    cfg.width = sz.width - (c-loc[0]);
	    cfg.height= sz.height;
	    x = sz.width - cfg.width;
	    this.actualGeom.width = x / m;
	    this.setWidth( x );
	}
	else {
	    // split around horizontal line at y
	    c = point[1];
	    if( c<=loc[1] || c>=loc[1]+sz.height )
		return null;
	    cfg.x = loc[0];
	    cfg.y = c;
	    cfg.height = sz.height - (c-loc[1]);
	    cfg.width = sz.width ;
	    x = sz.height - cfg.height;
	    this.actualGeom.height = x / m;
	    this.setHeight( x );
	}
	cfg.selected = this.selected;
	r = this.editor.addRegion( cfg );
	return r;
    },

    /**
     * The opposite of split. The other region is removed, and this region
     * grows to encompass the union. This will NOT work for arbitrary regions!
     */
    join : function( other ){
	var txy = this.getPosition(true);
	var tsz = this.getSize();
	var oxy = other.getPosition(true);
	var osz = other.getSize();
	var ori = (txy[0]===oxy[0] ? 'h' : (txy[1]===oxy[1] ? 'v' : undefined));
	var m = this.editor.getMagnification();
	var x,t,o;
	if(ori===undefined)
	    throw new Error("Non-joinable regions.");
	t=this;o=other;
	if(ori==='v' && txy[0] > oxy[0]
	|| ori==='h' && txy[1] > oxy[1]){
	   // switch this and other
	   t=other, o=this;
	   x=txy;txy=oxy;oxy=x;
	   x=tsz;tsz=osz;osz=x;
	}
	if( ori === 'v' ){
	    if(txy[0]+tsz.width !== oxy[0]) 
	        throw new Error("Non-joinable regions.");
	    t.setWidth(tsz.width+osz.width);
	    t.actualGeom.width += o.actualGeom.width;
	}
	else {
	    if(txy[1]+tsz.height !== oxy[1])
	        throw new Error("Non-joinable regions.");
	    t.setHeight(tsz.height+osz.height);
	    t.actualGeom.height += o.actualGeom.height;
	}
	t.editor.removeRegion(o);
    }

});

