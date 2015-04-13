// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {

	var EditorModel = require('editorGlobal/models/editorModel');

	var EditorItemBinModel = EditorModel.extend({

		urlRoot: '/clipboard/itembin',

		initialize: function() {},

		_parent: 'articles',
    	_siblings:'blocks',
        _children: 'components',

        // Block specific properties
        layoutOptions:  null,
        dragLayoutOptions: null,

        // These are the only attributes which should be permitted on a save
        whitelistAttributes: ['_id', '_courseId',  '_parentId', '_layoutOptions', 
            '_type', '_sortOrder', '_classes', 'body', 'displayTitle', 
            'title', '_extensions']

	});

	return EditorItemBinModel;

});