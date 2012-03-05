Ext.namespace("PRISM");

PRISM.Grid = Ext.extend( Ext.grid.GridPanel, {
    title: 'Images for this J: number',
    initComponent : function(){
	this.store = new Ext.data.GroupingStore({
	    sortInfo : { field : 'panelabel', direction:'ASC' },
	    groupField : '_image_key',

	    url : PRISM.config.IMAGEPANE_URL,

	    baseParams : {
		user : 'mgd_public',
		password : 'mgdpub',
		},

	    autoLoad : false,
	    reader : new Ext.data.JsonReader({
		root : 'images',
		idProperty : '_imagepane_key',
		messageProperty : 'message',
		fields : [
		    '_image_key',
		    'pixid',
		    'figurelabel',
		    'class',
		    'type',
		    '_imagepane_key',
		    'panelabel',
		    'coords',
		    ],
	        }),
	    writer : new Ext.data.JsonWriter(),
	    autoSave : false
	    });

	this.colModel = new Ext.grid.ColumnModel({
	    defaults: {
		width: 40,
		sortable: true,
		groupable : false,
	    },
	    columns: [
		{header: 'Pane Label', dataIndex: 'panelabel' },
		{header: 'Pane', dataIndex: '_imagepane_key' , hidden:true},
		{header: 'Coordinates', dataIndex : 'coords',
		    renderer:{
		        scope:this,
			fn:function(v,md,r,ri,ci,s){
			    return (v==null ? '?' : this.ownerCt.makeTag(v));
		    }}},
		{header: 'Image', dataIndex: '_image_key', hidden:true },
		{header: 'Class', dataIndex: 'class', hidden:true},
		{header: 'Type', dataIndex: 'type', hidden:true},
		{header: 'PixId', dataIndex: 'pixid', hidden:true },
		{header: 'Figure Label', dataIndex: 'figurelabel',width:120,hidden:true},
		{header: 'X', dataIndex: 'x', hidden:true},
		{header: 'Y', dataIndex: 'y', hidden:true},
		{header: 'Width', dataIndex: 'width', hidden:true},
		{header: 'Height', dataIndex: 'height', hidden:true},
	    ],
	    });
	this.view = new Ext.grid.GroupingView({
            forceFit:true,
	    startCollapsed : true,
	    // e.g. "Fig.label: 2 (Full size; 3 Panes)
            groupTextTpl: 
	        'Figure: {[ values.rs[0].get("figurelabel")]} ' +
	        '({[values.rs[0].get("type")  ]}; ' +
		'{[values.rs.length]} {[values.rs.length > 1 ? "Panes" : "Pane"]})'
        }),
	this.sm = new Ext.grid.RowSelectionModel({singleSelect:false});
	this.enableDragDrop = true;
	this.ddText = 'Pane';
	PRISM.Grid.superclass.initComponent.call(this);
	this.store.proxy.on('exception', function(px, tp, ac, op, re, ar){
	    if(re.message===undefined)
		re.message = Ext.util.JSON.decode(re.responseText).message;
	    Ext.Msg.show({ 
		title : 'SQL Error', 
		msg : re.message,
		buttons : Ext.Msg.OK,
		icon : Ext.Msg.ERROR
		});
	});
    }
});
