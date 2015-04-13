// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {

  var Backbone = require('backbone');
  var Origin = require('coreJS/app/origin');
  var EditorOriginView = require('editorGlobal/views/editorOriginView');
  var EditorComponentListItemView = require('editorPage/views/editorComponentListItemView');

  var EditorItemBinView = EditorOriginView.extend({

    tagName: "div",

    className: "editor-item-bin-list",

    events: {
      'click': 'onOverlayClicked',
      'click .editor-component-list-sidebar-exit': 'closeView',
      'keyup .editor-component-list-sidebar-search input': 'onSearchKeyup'
    },

    preRender: function(options) {
      $('html').css('overflow-y', 'hidden');
      this.listenTo(Origin, 'editorItemBinView:remove', this.remove);
      this.listenTo(Origin, 'window:resize', this.onScreenResize);
      this.setupCollection();
      this.setupFilters();


    },

    setupCollection: function() {
     // this.collection = new Backbone.Collection(this.model.get('componentTypes'));
    },

    setupFilters: function() {
  
    },

    postRender: function() {
     // this.renderComponentList();
      this.headerHeight = this.$('.editor-component-list-sidebar-header').height();
      $(window).resize();
    },

    closeView: function() {
      $('html').css('overflow-y', '');
      this.remove();
    },

    renderComponentList: function() {
      Origin.trigger('editorComponentListView:removeSubviews');
      var componentTypes = this.model.get('componentTypes');

      _.each(componentTypes, function(componentType) {

          var availablePositions = this.availablePositions;

          if (componentType.properties && componentType.properties.hasOwnProperty('._supportedLayout')) {
            var supportedLayout = componentTypes.properties.hasOwnProperty('._supportedLayout').enum;

            // Prune the available positions
            if (_.indexOf(supportedLayout, 'half-width') == -1) {
              availablePositions.left = false;
              availablePositions.right = false;
            }

            if (_.indexOf(supportedLayout, 'full-width') == -1) {
              availablePositions.full = false;
            }
          }

          this.$('.editor-component-list-sidebar-list').append(new EditorComponentListItemView({
            model: new Backbone.Model(componentType),
            // filter: this.filter,
            availablePositions: availablePositions,
            _parentId: this.model.get('_parentId'),
            $parentElement: this.$parentElement,
            parentView: this.parentView,
            searchTerms: componentType.displayName.toLowerCase()
          }).$el);

      }, this);

    },

    onOverlayClicked: function(event) {
      if ($(event.target).hasClass('editor-component-list')) {
        Origin.trigger('editorComponentListView:removeSubviews');
        $('html').css('overflow-y', '');
        this.remove();
      }
    },

   
    onScreenResize: function(windowWidth, windowHeight) {
   //   this.$('.editor-component-list-sidebar-list').height(windowHeight - this.headerHeight);
    }

  },
  {
    template: 'editorItemBin'
  });

  return EditorItemBinView;

});