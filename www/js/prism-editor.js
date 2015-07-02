Ext.namespace('PRISM');

PRISM.Editor = Ext.extend(Ext.Window, {
    x:10,
    y:10,
    width:800, height:600,
    closable:false,
    maximizable : false,
    maximized : true,
    magnification : 1.0,
    zoomFactor : 1.3,
    undoLimit : -1, // set to -1 for no limit
    url : null,
    jnum : null,
    autoScroll : true,
    minRegionWidth : 10,
    minRegionHeight : 10,

    /**
     * initComponent
     */
    initComponent : function(){
	this.layout = 'border';
	this.items = [
	    new PRISM.Grid({
	        region : 'west',
		ref : 'grid',
		collapsible : true,
		split : true,
		width : 300,
		}),
	    {
	    region : 'center',
	    layout:'absolute',
	    ref : 'panel',
	    autoScroll : true,
	    items:{
		xtype:'box',
		ref : '../image',
		x : 0,
		y : 0,
		autoEl: { tag: 'img' }
		}
	    }];
	this.tbar = this.makeMainToolbar();
	PRISM.Editor.superclass.initComponent.call(this);

	//
	this.currPanes = []; // subset of store's panes for current image

	//
	var me = this;
	this.osi = new Image(); // "osi" = offscreen image
	this.osi.onload = function(){
	    me.imageLoaded();
	    };
	this.on('afterrender', function(){
	    this.grid.store.on('save', this.afterSave, this);
	    this.grid.on('groupclick', this.groupClicked, this);
	    this.grid.getSelectionModel().on('selectionchange',function(sm){
		this.unselectAll();
		Ext.each(sm.getSelections(), function(p){
		    p.region && this.select(p.region);
		    }, this);
	        }, this);
	    this.lmask = new Ext.LoadMask( this.el, {
		msg : "Loading...",
		store : this.grid.store,
	        });
	    this.initDragDrop();
	    this.clickAssigner = new PRISM.ClickAutoAssigner({editor:this});
	    this.gridAssigner = new PRISM.GridAutoAssigner({editor:this});
	    this.onePaneAssigner = new PRISM.OnePaneAssigner({editor:this});
	    this.initKeys();

	    // Attach a click handler to each button in the toolbar that gives focus
	    // back to the editor. (If buttons keep focus, then hitting the spacebar
	    // is the same as clicking the button. This is an accessibility feature
	    // that we are turning off here. Should make this an option instead.
	    Ext.each(this.getTopToolbar().findByType('button'), function(b){
	        b.on('click', this.focus, this);
		}, this);

	}, this);

	this.undoStack = [];
	this.redoStack = [];

    },

    groupClicked : function(g,f,v,e){
	// the group value is a concat of the fig label and the image key. Split off the
	// key and pass it.
	var key = parseInt(v.match(/\d+$/)[0])
	this.openImage(key);
    },

    /**
     * Initializes key mappings for the editor.
     */
    initKeys : function(){
	// create a focuassable element. Needed so we can be sure to catch key events.
	this.focusEl = Ext.DomHelper.append(this.el,
	    {tag:'a',href:'#', style:'position:absolute;left:-1000;top:-1000;'},
	    true);

	this.keyDefaults = {
	    alt : true,
	    scope : this
	    },
	this.keyConfigs = [{
	    // page down
	    key:Ext.EventObject.PAGE_DOWN,
	    alt : false,
	    fn:function(){this.panel.body.scroll('d',this.panel.getHeight(),true);}
	    },{
	    // page up
	    key:Ext.EventObject.PAGE_UP,
	    alt : false,
	    fn:function(){this.panel.body.scroll('u',this.panel.getHeight(),true);}
	    },{
	    // save
	    key:'s', fn:function(){this.save();}
	    },{
	    // undo
	    key:'z', fn:function(){this.undoStack.length>0&&this.undo();},
	    },{
	    // redo
	    key:'r', fn:function(){this.redoStack.length>0&&this.redo();},
	    },{
	    // create cover
	    key:'c', fn:function(){this.pushState(); this.createCoveringRegion();},
	    },{
	    // grid auto assign
	    key:'g', fn:function(){this.pushState(); this.gridAssigner.reset();},
	    },{
	    // one-pane auto assign
	    key:'o', fn:function(){this.pushState(); this.onePaneAssigner.reset();},
	    },{
	    // select all
	    key:'a', fn:function(){this.selectAll();},
	    },{
	    // delete selected
	    key:'x', fn:function(){ this.pushState(); this.removeRegions(true); },
	    },{
	    // delete selected
	    key:[Ext.EventObject.DELETE,Ext.EventObject.BACKSPACE],
	    alt:false, stopEvent:true,
	    fn:function(){
		this.pushState();
		this.removeRegions(true);
		},
	    },{
	    // clear (delete all)
	    key:'x', shift:true, fn:function(){ this.pushState(); this.removeRegions(); },
	    },{
	    // zoom in
	    key:Ext.EventObject.NUM_PLUS, fn:this.zoomIn,
	    },{
	    // zoom out
	    key:Ext.EventObject.NUM_MINUS, fn:this.zoomOut
	    },{
	    // reset zoom
	    key:Ext.EventObject.ZERO, fn:this.zoomReset,
	    }];
	this.keyMap = new Ext.KeyMap(this.focusEl);
	Ext.each(this.keyConfigs, function(kc){
	    kc = Ext.applyIf(kc, this.keyDefaults);
	    this.keyMap.addBinding(kc);
	    }, this);

	this.keyMap.addBinding([{
	    key:Ext.EventObject.UP, fn:this.handleArrow, scope:this
	    },{
	    key:Ext.EventObject.DOWN, fn:this.handleArrow, scope:this
	    },{
	    key:Ext.EventObject.LEFT, fn:this.handleArrow, scope:this
	    },{
	    key:Ext.EventObject.RIGHT, fn:this.handleArrow, scope:this
	    }]);
    },

    // ---------------
    /**
     * Event handler for arrow keys. Nudges the selected region(s) in the
     * arrow's direction by 1 pixel. If the shift key is held, nudges by 10 px.
     */
    handleArrow : function(k,e){
	var dx = 0, dy = 0, m = e.shiftKey? 10 : 1;
	switch(k){
	case e.UP:	dy=-m; break;
	case e.DOWN:	dy=m; break;
	case e.LEFT:	dx=-m; break;
	case e.RIGHT:	dx=m; break;
	default: return false;
	}
	this.pushState();
	Ext.each(this.getRegions(true), function(r){
	    var xy = r.getPosition(true);
	    r.moveTo( Math.max(0, xy[0]+dx), Math.max(0, xy[1]+dy) );
	    }, this);
    },

    /**
     * Saves all accumu,ated changes to the databasew.
     */
    save : function(){
	this.grid.store.save();
    },

    /**
     * Callback after a save operation. (How does one check for success??)
     */
    afterSave : function(){
	this.clearUndo();
    },

    // ---------------

    /**
     * Pushes the given state onto the undo stack, and clears the redo stack.
     * If state is not specified, the current state is pushed.
     */
    pushState : function(state){
	var tb = this.getTopToolbar();
	state = state ? state : this.getState();
	this.undoStack.push(state);
	var ul = this.undoLimit;
	if(ul >= 0 && this.undoStack.length > ul)
	    this.undoStack.splice( 0, this.undoStack.length-ul );
	tb.undoButton.setDisabled(this.undoStack.length === 0);
	this.redoStack = [];
	tb.redoButton.disable();
    },

    /**
     * Implements the undo action.
     */
    undo : function(){
	var cs = this.getState();
	var tb = this.getTopToolbar();
	var s = this.undoStack.pop();
	s && this.restoreState(s);
	tb.undoButton.setDisabled(this.undoStack.length===0);
	this.redoStack.push(cs);
	tb.redoButton.enable();
    },

    /**
     * Implements the redo action.
     */
    redo : function(){
	var rs = this.redoStack.pop();
	var tb = this.getTopToolbar();
	if(!rs) return;
	var cs = this.getState();
	this.undoStack.push(cs);
	this.restoreState(rs);
	tb.undoButton.enable();
	tb.redoButton.setDisabled(this.redoStack.length===0);
    },

    /**
     * Clears the undo/redo stacks.
     */
    clearUndo : function(){
	var tb = this.getTopToolbar();
	this.undoStack = [];
	this.redoStack = [];
	tb.undoButton.disable();
	tb.redoButton.disable();
    },

    // ---------------

    /**
     * Returns an object representing the current editing state.
     * Args:
     *	none
     * Returns:
     *	Object representing the state.
     *	- url - URL of current image
     *	- magnification - zoom magnification
     *	- panes - list of pane config objects, one per pane
     *	- regions - list of region config object, one per region
     */
    getState : function(){
	var rcfgs = [];
	var pcfgs = [];
	Ext.each(this.getRegions(), function(r){
	    rcfgs.push(r.getState());
	    }, this);
	this.currPanes.each(function(p){
	    var c = p.get('coords');
	    if(c) c = Ext.apply({},c);//make a copy
	    pcfgs.push({ id:p.id, coords:c, dirty:p.dirty });
	    }, this);
	return {
	    url : this.getUrl(),
	    magnification : this.getMagnification(),
	    panes : pcfgs,
	    regions : rcfgs
	    };
    },

    /**
     * Restores the editing state to that specified by the state argument.
     * Args:
     *	state	(object) An object representing the state to restore. See getState().
     * Returns:
     *  nothing
     */
    restoreState : function(state){
	this.setMagnification(state.magnification);
	this.removeRegions();
	this.setUrl(state.url);
	var t2r = {};
	Ext.each(state.regions, function(cfg){
	    var r = this.addRegion(cfg);
	    t2r[this.makeTag(r)] = r;
	    }, this);
	Ext.each(state.panes, function(pcfg){
	    var p = this.grid.getStore().getById(pcfg.id);
	    p.region = undefined;
	    if(pcfg.coords){
		var r = t2r[this.makeTag(pcfg.coords)];
		r ? this.associate(p,r) : p.set('coords',null);
	    }
	    else
	        p.set('coords',null);
	    pcfg.dirty ? p.markDirty() : p.commit();
	    }, this);
    },

    // ---------------
    showPdf: function(){
	var j = parseInt(this.jnum.match(/\d+/)[0]),
	    m = j - j%500,
	    u = PRISM.config.JFILE_URL + m + "/J" + j + ".pdf";
	open(u);
    },

    /**
     * Opens a window that allows user to specify user name and password for
     * database logins.
     */
    openLogin : function(){
	/*
	var lw = this.loginWindow,
	    s = this.grid.store;
	if(!lw){
	    var cfg = {
		title : "Login",
		modal : true,
		closable : true,
		closeAction : 'hide',
		layout : 'form',
		x:200, y:100, width:250, autoHeight : true,
		items : [{
		    fieldLabel : 'User name',
		    ref : 'user',
		    xtype : 'textfield',
		    value : s.baseParams.user,
		    selectOnFocus : true
		    },{
		    fieldLabel : 'Password',
		    ref : 'password',
		    xtype : 'textfield',
		    autoCreate : {tag: 'input', type: 'password', size: '20', autocomplete: 'off'},
		    value : s.baseParams.password,
		    selectOnFocus : true
		    }],
		buttons : [{
		    text : 'OK',
		    handler : function(){
			var lw = this.loginWindow,
			    s  = this.grid.store;
			s.setBaseParam('user', lw.user.getValue());
			s.setBaseParam('password', lw.password.getValue());
			lw.hide();
		        },
		    scope : this
		    },{
		    text : 'Cancel',
		    handler : function(){
			this.loginWindow.hide();
		        },
		    scope : this
		    }]
		};
	    this.loginWindow = lw = new Ext.Window(cfg);
	}
	lw.user.setRawValue(s.baseParams.user);
	lw.password.setRawValue(s.baseParams.password);
	lw.show();
    */
    },

    // ---------------
    openUpload : function(){
	var fp;
	if(!this.uploadWindow){
	    fp = new Ext.form.FormPanel({
		autoScroll : true,
		padding : 6,
		fileUpload : true,
		url : PRISM.config.PIXELDB_UPLOAD_URL,
		ref : 'formPanel',
		submitEmptyText : false,
		items : [{
		    xtype : 'hidden',
		    name : 'image_submission_form'
		    },{
		    xtype : 'hidden',
		    name : 'jnum',
		    value : this.jnum.slice(2)
		    },{
		    xtype : 'hidden',
		    name : 'userID'
		    },{
		    xtype : 'hidden',
		    name : 'pwd'
		    }]
		});
	    this.imgStore.each(function(irec){
		var _key=irec.get('_image_key'),
		    pixid=irec.get('pixid');
		fp.add({
		    xtype:'fileuploadfield',
		    name : 'imageKey_'+_key,
		    fieldLabel:'Figure '+irec.get('figurelabel'),
		    disabled : pixid ? true : false,
		    value : pixid && ('Current pix id: ' + pixid) || 'Select file...',
		    listeners : {
			fileselected : function(f,v){
			    f.setRawValue(v.split(/[:\\\/]/).slice(-1)[0]);
			} }
		    });
	    }, this);
	    this.uploadWindow = new Ext.Window({
		title : "Upload Images for Jnum " + this.jnum,
		modal : true,
		closable : true,
		closeAction : 'hide',
		layout : 'fit',
		x:100, y:50, width:330, height:250,
		items : fp,
		buttons : [{
		    text : 'Cancel',
		    handler : function(){
			this.uploadWindow.formPanel.form.reset();
			this.uploadWindow.hide();
		        },
		    scope : this
		    },{
		    text : 'Upload',
		    handler : function(){
			var uw = this.uploadWindow,
			    f=uw.formPanel.form,
			    lw = this.loginWindow,
			    u = lw.user.getValue(),
			    p = lw.password.getValue();
			f.findField('userID').setValue(u);
			f.findField('pwd').setValue(p);
			f.items.each(function(inp){
			    if(inp.xtype==='fileuploadfield')
				inp.setDisabled(inp.fileInput.dom.value === "");
			    }, this);
			f.submit();
			uw.hide();
		        },
		    scope : this
		    }]
		});
	}

	this.uploadWindow.formPanel.form.items.each(function(inp){
	    inp.setDisabled(inp.initialConfig.disabled);
	    });
	this.uploadWindow.show();
    },

    // ---------------

    /**
     * Returns the list (a MixedCollection) of pane records for the currently opened image.
     */
    getCurrentPanes : function(){
	return this.currPanes;
    },

    /**
     * Returns a (possibly empty) list of the panes currently selected in the grid view.
     */
    getSelectedPanes : function(){
	return this.grid.getSelectionModel().getSelections();
    },

    // ---------------

    /**
     * Returns the URL that is the currently displayed image's src attribute.
     */
    getUrl : function(){
	return this.image.el.dom.src;
    },

    /**
     * Sets the displayed image url; switches the image.
     */
    setUrl : function(url){
	var cu = this.getUrl();
	if( cu !== url ){
	    this.image.el.dom.src = url;
	    this.lmask.show();
	    this.osi.src = url;
	}
    },

    /**
     * Callback called when a new imgage has been loaded into the offscreen image (osi).
     * Resets the displayed image's size to the actual (osi) size, and sets the displayed image's
     * src to the same url. (Browser has image cached, so this doesn't cost us anything.)
     */
    imageLoaded : function(){
	this.image.setSize( this.osi.width, this.osi.height );
	this.lmask.hide();
	this.focus();
    },

    // ---------------

    /*
     * For some specified action (which will lose any unsaved changes),
     * first asks the user whether to save the changes (yes/no), or to
     * cancel the action. If user answers 'yes', changes are saved, then the
     * action is performed. If 'no', the action is performed with no save.
     * if cancel, nothing happens.
     * Args:
     *	action	(function) The action to perform.
     *	scope	(object) The scope in which to execute action.
     *	args	(array) Arguments to pass to action.
    **/
    saveBeforeAction : function(action, scope, args){
	var mods = this.grid.store.getModifiedRecords(),
	fn = function(answer){
	    switch(answer){
	    case "yes":
		this.grid.store.save();
		action.apply(scope, args||[]);
		break;
	    case "no":
		action.apply(scope, args||[]);
		break;
	    case "cancel":
		this.getTopToolbar().jnumField.setRawValue(this.jnum);
		break;
	    } };
	if( mods && mods.length > 0 ){
	    Ext.Msg.show({
		title:'Save Changes?',
		msg: 'There are unsaved changes. Would you like to save your changes?',
		buttons: Ext.Msg.YESNOCANCEL,
		fn: fn,
		scope : this,
		animEl: 'elId',
		icon: Ext.MessageBox.QUESTION
	    });
	}
	else
	    action.apply(scope, args||[]);
    },

    /**
     * Returns the currently loaded Jnum.
     */
    getJnum : function(){
	return this.jnum;
    },

    /**
     * Sets the jnum; loads the new jnum's data and opens its first image (if any).
     */
    setJnum : function(jnum){
	this.uploadWindow && this.uploadWindow.close();
	this.uploadWindow = null;
	this.clearUndo();
	this.removeRegions();
	this.jnum = jnum;
	this.imageId = null;
	this.getTopToolbar().jnumField.setRawValue(jnum);
	this.grid.getStore().on('load', this.jnumLoaded, this, {single:true});
	this.grid.store.load({ params : { jnum:this.jnum } });
    },

    /**
     * Callback called after new jnum's data have been loaded.
     */
    jnumLoaded : function(){
	var id, r;
	var s = this.grid.getStore();

	// suppress thumbnails for now...
	s.clearFilter();
	s.filterBy(function(r){ return r.get('type')!=="Thumbnail";});

	// create store of distinct image records (the main store contains
	// image pane data, which replicates image info for each pane).
	this.imgStore = new Ext.data.Store();
	s.each(function(r){
	    var k = r.get('_image_key');
	    if(this.imgStore.indexOfId(k)===-1){
		this.imgStore.add(r.copy(k));
	    }
	}, this);

	r = s.getAt(0);
	if(r){
	    id = r.get('_image_key');
	    this.openImage(id);
	}
	else {
	    this.showNoImage();
	    this.lmask.hide(); // not consistently done by store in this case, so we'll make sure...
	    Ext.Msg.alert("Jnum not found, or has no Figures.");
	}
	s.commitChanges();
    },

    /**
     * Handler called when user enters a J# in the text field.
     */
    jnumHandler : function(jnum){
	jnum = "" + ((typeof(jnum) === "object") ? jnum.getValue() : jnum);
	jnum = (jnum.indexOf("J:") === 0 ? jnum : "J:"+jnum);
	this.saveBeforeAction(this.setJnum, this, [jnum]);
    },

    // ---------------

    /**
     * Returns the current magnification level.
     */
    getMagnification : function(){
        return this.magnification;
    },

    /**
     * Sets the current magnification level. This is a multiplier. Thus
     * a magnification of 1.0 is no magnification (i.e., original size),
     * numbers > 1 will "zoom in" and those between 0 and 1 "zoom out".
     */
    setMagnification : function(mag){
	mag = mag ? mag : this.magnification;
	this.magnification = mag;
	this.image.setWidth( this.osi.width  * this.magnification );
	this.image.setHeight( this.osi.height * this.magnification );
	Ext.each(this.getRegions(), function(r){
	    r.syncGeometry();
	    }, this);
    },

    /**
     * Shorthand for multiplying current magnification by the zoom factor.
     */
    zoomIn : function(){
        this.setMagnification(this.getMagnification() * this.zoomFactor);
    },

    /**
     * Shorthand for dividing current magnification by the zoom factor.
     */
    zoomOut : function(){
        this.setMagnification(this.getMagnification() / this.zoomFactor);
    },

    /**
     * Shorthand for setting the current magnification to 1.
     */
    zoomReset : function(){
        this.setMagnification(1.0);
    },

    // ---------------

    /**
     * Loads and displays the image associated with the given image
     * stub (_image_key).
     *
     * Most of the
     * work is drawing any regions already defined in panes.
     */
    openImage : function(id){ // "id" actually means _image_key (FIXME)
	var s = this.grid.getStore();
	var t2r,tag,r, px, p0, p1;
	this.grid.getSelectionModel().clearSelections();
	this.getTopToolbar().clickAssignButton.toggle(false);
	//
	this.currPanes = s.query("_image_key", new RegExp("^"+id+"$"));
	p0 = this.currPanes.get(0);
	p1 = this.currPanes.get(this.currPanes.getCount()-1);
	this.currPanesRange = [ s.indexOf(p0), s.indexOf(p1) ];
	//
	var gv = this.grid.getView();
	gv.collapseAllGroups();
	gv.toggleRowIndex(this.currPanesRange[0], true)
	//
	if(this.imageId !== id){
	    this.imageId = id;
	    this.clearUndo();
	    this.removeRegions();
	    this.setMagnification(1);
	    px = this.currPanes.get(0).get('pixid');
	    if(!px){
		this.showNoImage();
		this.lmask.hide();
		return;
	    }
	    this.panel.body.removeClass('prism-noimage');
	    this.setUrl(PRISM.config.PIXELDB_FETCH_URL+px);
	    t2r = {};
	    this.currPanes.each(function(p){
	        var c = p.get('coords'),
		    d = p.dirty;
	        if(c){
		    tag = this.makeTag(c);
		    r = t2r[tag];
		    if(!r){
			r = this.addRegion(Ext.apply({},c));
			t2r[tag]=r;
		    }
		    this.associate(p,r);
		    if(!d) p.commit();
	        }
	    }, this);
	}
    },

    showNoImage : function(){
	this.setUrl(Ext.BLANK_IMAGE_URL);
	this.panel.body.addClass('prism-noimage');
    },

    // ---------------

    /**
     * For a given region, returns a tag that (a) is human readable and (b) uniquely
     * identifies the region. Our rule is that no two regions may have identical
     * geometries. So the tag simply reports the geometry.
     */
    makeTag : function(r){
	var s = r.actualGeom?r.actualGeom:r;
	return 'x:' + Math.round(s.x) +
	       ' y:' + Math.round(s.y) +
	       ' w:' + Math.round(s.width) +
	       ' h:' + Math.round(s.height);
    },

    // ---------------

    /**
     * Regenerates the labels displayed by regions, and the coordinates displayed by panes.
     */
    syncLabels : function(){
	var lbl;
	var r;
	if(!this.currPanes)
	    // before init, do nothing
	    return;
	Ext.each(this.getRegions(), function(r){
	    r.setLabel("");
	    });
	this.currPanes.each( function(p){
	    var r = p.region;
	    if(r){
	        r.setLabel( r.getLabel() + Ext.util.Format.htmlEncode(p.get('panelabel')) + '; ' );
		p.set('coords', r.getActualGeometry());
	    }
	}, this);
    },

    /**
     * Associates the given pane (Record) and region (PRISM.Region)
     */
    associate : function(p, r) {
	p.region = r;
	p.set('coords', r.getActualGeometry() );
	r.on('resize', function(rr){
	    this.set('coords', rr.getActualGeometry());},
	    p );
	this.syncLabels();
    },

    /**
     * Removes the association between the given pane and region.
     */
    dissociate : function(p, r){
	if(p.region === r){
	    p.set('coords', null );
	    p.region = null;
	    this.syncLabels();
	}
    },

    /**
     * Creates a new region from the given config object and adds it to the current image.
     */
    addRegion : function(cfg){
	cfg.editor=this;
	var r = new PRISM.Region(cfg);
	var n = this.getRegions().length;
	r.on( 'resize', this.syncLabels, this);
	r.on( 'move', this.syncLabels, this);
	this.panel.add(r);
	this.doLayout();
	return r;
    },

    /**
     * Shorthand for adding a region that exactly covers the displayed image.
     */
    createCoveringRegion : function(){
	var cfg = {
	    x:0,
	    y:0,
	    width:this.image.getWidth(),
	    height:this.image.getHeight(),
	    selected:true
	    };
	return this.addRegion(cfg);
    },

    /**
     * Removes the given region and dissociates it from any panes.
     */
    removeRegion : function(r){
	this.currPanes.each( function(p){ this.dissociate(p,r); }, this);
	this.panel.remove(r);
	this.syncLabels();
    },

    /**
     * Removes each region in a list.
     */
    removeRegions : function(selected){
	Ext.each( this.getRegions(selected), this.removeRegion, this);
    },

    /**
     * Returns a list of regions. With no argument, returns all regions in the current
     * image. With a boolean argument, returns regions that are (true) or are not (false) currently
     * selected.
     */
    getRegions : function(selected){
	if(selected === undefined || selected === null)
	    return this.findBy(function(x){return x instanceof PRISM.Region;})
	else
	    return this.findBy(function(x){return x instanceof PRISM.Region && x.isSelected()===selected;})
    },

    /**
     * With no argument, selects all regions. With a boolean arg, sets the selection state
     * of all regions to the specified value.
     */
    selectAll : function(val){
	Ext.each( this.getRegions(), function(){this.setSelected(val);} );
    },

    /**
     * Shorthand for selectAll(false)
     */
    unselectAll : function(){
	this.selectAll(false);
    },

    /**
     * Selects the specified region.
     */
    select : function(r){
	r.setSelected(true);
    },

    /**
     * Unselects the specified region.
     */
    unselect : function(r){
	r.setSelected(false);
    },

    /**
     * Toggles the selection state of every region.
     */
    toggleAllRegions : function(){
	Ext.each( this.getRegions(), function(){this.toggleSelected();} );
    },

    /**
     * Makes all regions invisible or visible (by add/removing css class "prism-hideregions").
     * With no argument, hides all regions. With a boolean arg, sets the hidden state of
     * all regions to that value.
     */
    hideRegions : function(hide){
	hide = (hide===undefined?true:hide);
	this.panel.el[hide?'addClass':'removeClass']('prism-hideregions');
    },

    /**
     * Splits regions along a horizontal or vertical line passing through point.
     * Point is an (x,y) pair in pixels.
     * Orientation is either 'h' (horizontal) or 'v' (vertical).
     * If selected is undefined, splits all regions intersected by the line. If it
     * is a boolean, then split is limited to selected (true) or unselected (false) regions.
     */
    splitRegions : function( point, orientation, selected ){
	Ext.each(this.getRegions(selected), function(r){ r.split(point,orientation); });
    },

    /**
     * Handler for mouse clicks.
     *
     * If altKey:
     *  click		splits selected regions on vertical line through event xy
     *  shift-click	splits selected regions on horizontal line through event xy
     * else:
     *	click		selects me and unselects everyone else
     *  shift-click	toggles my selection state
     *
     */
    clicked : function(evt, region){
	var exy = evt.getXY();
	var wxy = this.image.getPosition();
	var xy = [exy[0]-wxy[0], exy[1]-wxy[1]];
	var r;
	//evt.stopEvent();
	this.focus();
	if(evt.altKey){
	    this.pushState();

	    // Helpful shortcut (I hope). If there are no regions and user
	    // tries to split, automatically create a covering region and
	    // and split that.
	    if(this.getRegions().length===0)
		this.createCoveringRegion();

	    if(evt.shiftKey)
		// split along vertical
		this.splitRegions( xy, 'v', true );
	    else
		// split along horizontal
		this.splitRegions( xy, 'h', true );
	}
	else {
	    if(!region)
		this.unselectAll();
	    else if(! evt.shiftKey){
		this.unselectAll();
		this.select(region);
		this.clickAssigner.click(region);
	    }
	    else
		region.toggleSelected();
	}
    },

    /**
     * Gives focus to the editor's focus element. (In order to catch key events
     * in all browsers (Firefox, you know who you are), there has to be a focussable
     * element that actually has focus.)
     */
    focus : function(){
	this.focusEl.focus();
    },

    /**
     * Returns a toolbar config for creating the top toolbar of the app.
     * Split out for readability's sake.
     */
    makeMainToolbar : function(){
	return {
	    enableOverflow: true,
	    items : [{
		text : 'Login',
		tooltip : 'Set database username and password.',
		handler : function(){ this.openLogin(); this.focus(); },
		scope : this
		},'-',{
		xtype : 'textfield',
		tooltip : 'Enter a J# for a ref containing images.',
		width : 80,
		ref : 'jnumField',
		name : 'imageId',
		emptyText : 'Enter J:num (eg J:12604).',
		selectOnFocus : true,
		listeners : {
		    change : this.jnumHandler,
		    specialkey : function(f,e){
			var k = e.getKey();
		        if(k===e.ENTER || k===e.TAB)
			    // Do NOT call jnum handler here. Why? Because change event will
			    // fire later, which will call it again. Instead, just pass focus
			    // away (to internal focus elt), which will trigger the change event.
			    this.focus();
			},
		    scope : this
		    }
		},{
		text : 'Reload',
		tooltip : 'Reload the current Jnum.',
		handler : function(){this.jnumHandler(this.jnum);},
		scope : this
		},'-',{
		text : 'PDF',
		tooltip : 'Show the PDF file for the current Jnumber.',
		handler : this.showPdf,
		scope : this
		},'-',{
		text : 'Save',
		tooltip : 'Save image pane changes.',
		handler : function(){ this.save(); this.focus(); },
		scope : this
		},'-',{
		text : 'Upload',
		disabled : true,
		tooltip : 'Upload image files for this Jnum.',
		handler : function(){ this.openUpload(); this.focus(); },
		scope : this
		},'-',{
		text : '-1',
		tooltip : 'Zoom out.',
		handler : function(){ this.zoomOut(); this.focus(); },
		scope : this
		},{
		text : '0',
		tooltip : 'Reset to actual image size.',
		handler : function(){ this.zoomReset(); this.focus(); },
		scope : this
		},{
		text : '+1',
		tooltip : 'Zoom in.',
		handler : function(){ this.zoomIn(); this.focus(); },
		scope : this
		},'-',{
		text : 'ClickAssign',
		tooltip : 'Associates panes to regions you click.',
		ref : 'clickAssignButton',
		enableToggle : true,
		toggleHandler : function(b,s){ this.clickAssigner.setEnabled(s); },
		scope : this
		},'-',{
		text : 'GridAssign',
		tooltip : 'Associates panes to grid of regions.',
		ref : 'gridAssignButton',
		handler : function(b){ this.pushState(); this.gridAssigner.reset(); },
		scope : this
		},'-',{
		text : 'OnePane',
		tooltip : 'One click for a single-pane image.',
		handler : function(b){ this.pushState(); this.onePaneAssigner.reset(); },
		scope : this
		},'-',{
		text : 'Undo',
		tooltip : 'Undo.',
		ref  : 'undoButton',
		handler : this.undo,
		disabled : true,
		scope : this
		},'-',{
		text : 'Redo',
		tooltip : 'Redo.',
		ref  : 'redoButton',
		handler : this.redo,
		disabled : true,
		scope : this
		},'-',{
		text : 'Cover',
		tooltip : 'Create a region that covers the image.',
		handler : function(){this.pushState();this.createCoveringRegion(true);this.focus();},
		scope : this
		},'-',{
		text : 'Delete',
		tooltip : 'Delete currently selected regions.',
		handler : function(){this.pushState();this.removeRegions(true);},
		scope : this
		},
		'-', '->', '-',
		{
		text : 'SelectAll',
		tooltip : 'Select all regions.',
		handler : this.selectAll,
		scope : this
		},'-',{
		text : 'Hide',
		tooltip : 'Hide regions (so you can see the image!)',
		enableToggle : true,
		toggleHandler : function(b,s){ this.hideRegions(s); },
		scope : this
		},'-',{
		text : 'Clear',
		tooltip : 'Removes all regions.',
		handler : function(){this.pushState();this.removeRegions();},
		scope : this
		},'-',{
		text : 'Help',
		tooltip : "It ain't great, but it's better than nothing!",
		handler : this.showHelp,
		scope : this
	        }]
	    };
    },

    /**
     * Open (create in necessary) the help doc window.
     */
    showHelp : function(){
	if(!this.helpWindow){
	    this.helpWindow = new Ext.Window({
		title : "Help (of a sort)",
		autoScroll : true,
		x : 150, y : 150, width : 650, height : 400,
		closable : true, closeAction : 'hide',
		plugins : new PRISM.plugins.WindowCorraler(),
		listeners : {
		    render : function(w){
		        var e = w.body;
			var u = e.getUpdater();
			u.update(PRISM.config.HELP_URL);
			},
		    scope  : this
		    }

	        });
	}
	this.helpWindow.show();
    },


    /**
     * Initialize drag and drop behaviors.
     */
    initDragDrop : function(){
	// The drop zone responds to dropping a pane label on a region
	// i.e., it creates the association between them.
	this.dropZone = new Ext.dd.DropZone(this.panel.body, {
	    ddGroup : this.grid.getView().dragZone.ddGroup,
	    editor : this,
	    getTargetFromEvent: function(e) {
		e.stopEvent();
		return e.getTarget('.prism-region');
		},
	    onNodeEnter : function(t, dd, e, data){
		this.editor.unselectAll();
		this.editor.select(Ext.getCmp(t.id));
		},
	    onNodeOver : function(t, dd, e, data){
		return Ext.dd.DropZone.prototype.dropAllowed;
	        },
	    onNodeOut : function(t, dd, e, data){
		this.editor.unselect(Ext.getCmp(t.id));
	        },
	    onNodeDrop : function(t, dd, e, data){
		var r = Ext.getCmp(t.id);
		e.stopEvent();
		this.editor.pushState();
		Ext.each(data.selections, function(p){
		    this.editor.associate(p,r);
		    }, this);
		this.editor.select(r);
		return true;
		}
	    });

	// The drag zone responds to all other mouse events in the image area:
	// clicks, drags, etc.
	this.dragZone = new Ext.dd.DragZone(w.panel.el, {
	    editor : this,
	    proxy : new Ext.dd.StatusProxy({ shadow:false, animRepair : false }),
	    getDragData : function(e){
		var t = e.getTarget();
		var xy = e.getXY();
		this.startX = xy[0];
		this.startY = xy[1];
		this.currXY = xy;
		e.stopEvent();
		this.editor.focus();
		var ed = this.editor.panel.body.dom;
		var bxy = this.editor.panel.body.getXY();
		var mindist = 18; // too close distance
		if(ed.scrollWidth > ed.offsetWidth){
		    // horiz scrollbar is showing
		    var dy = ed.offsetHeight - (xy[1]-bxy[1])
		    if(dy < mindist) return;
		}
		if(ed.scrollHeight > ed.offsetHeight){
		    // vert scrollbar is showing
		    var dx = ed.offsetWidth  - (xy[0]-bxy[0])
		    if(dx < mindist) return;
		}

		return {ddel:t, mode:"draw", ed:ed, didDrag:false};
		},
	    onInitDrag : function(x,y){
		this.dragData.didDrag = true;
		if(this.dragData.mode == "draw"){
		    this.proxy.el.addClass('prism-dd-proxy');
		    this.proxy.el.setXY([x,y]);
		    this.proxy.ghost.hide();
		    this.setDelta(0,0);
		    this.onStartDrag(x, y);
		    return true;
		} },
	    alignElWithMouse : function(el,x,y){
		if(this.dragData.mode == "draw"){
		    this.proxy.el.removeClass(this.dropAllowed);
		    this.proxy.el.removeClass(this.dropNotAllowed);
		    var xy = [Math.min(x,this.startX), Math.min(y,this.startY)]
		    var wh = {width:Math.abs(x-this.startX)+1, height:Math.abs(y-this.startY)+1};
		    this.currXY = xy;
		    this.proxy.el.setXY(xy);
		    this.proxy.el.setSize( wh );
		}},
	    // override this to prevent animation after a "failed drop".
	    afterRepair : function(){
	        this.dragging=false;
		},
	    onMouseUp : function(e){
		if(! this.dragData.didDrag){
		    // just a click...delegate to clicked() handler.
		    var rel = e.getTarget('.prism-region',1,true);
		    var r = rel ? Ext.getCmp(rel.id) : undefined;
		    this.editor.clicked(e,r);
		}
		else {
		    // what a drag... :-)
		    var ed = this.dragData.ed;
		    if(this.dragData.mode=="draw"){
			// user drew a new region.
			var el = this.proxy.el;
			var exy = this.currXY;
			var pxy = this.editor.panel.el.getXY();
			var cfg = {
			    x:exy[0]-pxy[0] + ed.scrollLeft,
			    y:exy[1]-pxy[1] + ed.scrollTop,
			    width:el.getWidth(),
			    height:el.getHeight(),
			    };
			if(cfg.width  >= this.editor.minRegionWidth
			&& cfg.height >= this.editor.minRegionHeight){
			    this.editor.pushState();
			    this.editor.unselectAll();
			    this.editor.select(this.editor.addRegion(cfg));
			}
		    }
		}},
	});
    }
});

