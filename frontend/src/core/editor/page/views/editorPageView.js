// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require){

  var Backbone = require('backbone');
  var Handlebars = require('handlebars');
  var Origin = require('coreJS/app/origin');
  var EditorOriginView = require('editorGlobal/views/editorOriginView');
  var EditorModel = require('editorGlobal/models/editorModel');
  var EditorArticleView = require('editorPage/views/editorArticleView');
  var EditorArticleModel = require('editorPage/models/editorArticleModel');
  var EditorPasteZoneView = require('editorGlobal/views/editorPasteZoneView');

  var EditorPageView = EditorOriginView.extend({

    tagName: 'div',

    className: 'page',

    events: {
      'click a.add-article'  : 'addArticle',
      'click a.edit-page'    : 'loadPageEdit',
      'click a.delete-page'  : 'deletePage',
      'click .paste-cancel'  : 'pasteCancel'
    },

    childrenCount: 0,
    childrenRenderedCount: 0,

    preRender: function() {
      this.setupChildCount();

      this.listenTo(Origin, 'editorView:removeSubViews', this.remove);
      this.listenTo(Origin, 'editorView:moveArticle:' + this.model.get('_id'), this.render);
      this.listenTo(Origin, 'editorView:cutArticle:' + this.model.get('_id'), this.onCutArticle);
      this.listenTo(Origin, 'editingOverlay:views:hide', this.persistScrollPosition);
      this.listenTo(Origin, 'pageView:itemRendered', this.evaluateChildStatus);

      var captureScroll = function() {
        $(window).scroll(function() {
          if (window.scrollY != 0) {
            Origin.editor.scrollTo = window.scrollY;
          }
        });
      };

      _.delay(captureScroll, 2000);
    },

    persistScrollPosition: function() {
      if (Origin.editor.scrollTo) {
        $.scrollTo(Origin.editor.scrollTo);
      }
    },

    setupChildCount: function() {
      var articles = Origin.editor.data.articles.where({_parentId: this.model.get('_id')});
      var articleList = [], blockList = [];

      _.each(articles, function(article) {
        articleList.push(article.get('_id'));
      });

      var blocks = _.filter(Origin.editor.data.blocks.models, function (block) {
        return _.contains(articleList, block.get('_parentId'));
      });

      _.each(blocks, function(block) {
        blockList.push(block.get('_id'));
      });

      var components = _.filter(Origin.editor.data.components.models, function(component) {
        return _.contains(blockList, component.get('_parentId'));
      });

      this.childrenCount = articles.length + blocks.length + components.length;
    },

    evaluateChildStatus: function() {
      this.childrenRenderedCount++;

      if (this.childrenCount == this.childrenRenderedCount) {
        // All child controls of the page have been rendered so persist the scroll position
        this.persistScrollPosition();
      }
    },

    postRender: function() {
      this.addArticleViews();

      _.defer(_.bind(function(){
        this.trigger('pageView:postRender');
        this.setViewToReady();
      }, this));
    },

    addArticleViews: function() {
      this.$('.page-articles').empty();
      Origin.trigger('editorPageView:removePageSubViews');

      // Insert the 'pre' paste zone for articles
      var prePasteArticle = new EditorArticleModel();
      prePasteArticle.set('_parentId', this.model.get('_id'));
      prePasteArticle.set('_type', 'article');
      prePasteArticle.set('_pasteZoneSortOrder', 1);

      this.$('.page-articles').append(new EditorPasteZoneView({model: prePasteArticle}).$el);

      // Iterate over each article and add it to the page
      this.model.getChildren().each(function(article) {
        this.addArticleView(article);
      }, this);
    },

    addArticleView: function(articleModel, scrollIntoView, addNewBlock) {
  
      var newArticleView = new EditorArticleView({model: articleModel}),
        sortOrder = articleModel.get('_sortOrder');

        // Add syncing class
      if (articleModel.isNew()) {
        newArticleView.$el.addClass('syncing');
      }
      
      scrollIntoView = scrollIntoView || false;
        
      this.$('.page-articles').append(newArticleView.$el);
      
      if (scrollIntoView) {
        $.scrollTo(newArticleView.$el, 200);
      }

      // Increment the 'sortOrder' property
      articleModel.set('_pasteZoneSortOrder', sortOrder++);

      // Post-article paste zone - sort order of placeholder will be one greater
      this.$('.page-articles').append(new EditorPasteZoneView({model: articleModel}).$el);
      // Return the article view so syncing can be shown
      return newArticleView;
    },

    deletePage: function(event) {
      event.preventDefault();
      
      if (confirm(window.polyglot.t('app.confirmdeletepage'))) {
        if (this.model.destroy()) {
          this.remove();
          Origin.trigger('editorView:refreshPageList');
        }
      }
    },

    addArticle: function(event) {
      event.preventDefault();
      
      var _this = this;
      var newPageArticleModel = new EditorArticleModel({
        title: window.polyglot.t('app.placeholdernewarticle'),
        displayTitle: '',
        body: '',
        _parentId: _this.model.get('_id'),
        _courseId: Origin.editor.data.course.get('_id'),
        _type:'article'
      });

      var newArticleView = _this.addArticleView(newPageArticleModel);

      newPageArticleModel.save(null, {
        error: function() {
          Origin.Notify.error({
              message: window.polyglot.t('app.errorarticleadd'),
              _template: 'alert'
          });
        },
        success: function(model, response, options) {

          Origin.editor.data.articles.add(model);
          newArticleView.$el.removeClass('syncing').addClass('synced');
          newArticleView.addBlock();
          
        }
      });
    },

    loadPageEdit: function (event) {
      event.preventDefault();
      Origin.trigger('editorSidebarView:addEditView', this.model);
    },

    onCutArticle: function(view) {
      this.once('pageView:postRender', function() {
        view.showPasteZones();
      });

      this.render();
    },

  }, {
    template: 'editorPage'
  });

  return EditorPageView;

});
