import run from 'ember-metal/run_loop';
import jQuery from 'ember-views/system/jquery';
import EmberView from 'ember-views/views/view';
import { Binding } from 'ember-metal/binding';
import EmberObject from 'ember-runtime/system/object';
import { computed } from 'ember-metal/computed';
import ContainerView from 'ember-views/views/container_view';
import htmlbarsCompile from 'ember-htmlbars/system/compile';
import EmberHandlebars from "ember-handlebars";
import { ViewHelper as handlebarsViewHelper } from 'ember-handlebars/helpers/view';
import { ViewHelper as htmlbarsViewHelper } from 'ember-htmlbars/helpers/view';
import { appendView, destroyView } from "ember-views/tests/view_helpers";

import { set } from 'ember-metal/property_set';

var compile, view, MyApp, originalLookup, lookup;

var trim = jQuery.trim;

if (Ember.FEATURES.isEnabled('ember-htmlbars')) {
  compile = htmlbarsCompile;
} else {
  compile = EmberHandlebars.compile;
}

QUnit.module('ember-htmlbars: binding integration', {
  setup: function() {
    originalLookup = Ember.lookup;
    Ember.lookup = lookup = {};

    MyApp = lookup.MyApp = EmberObject.create({});
  },

  teardown: function() {
    Ember.lookup = originalLookup;

    destroyView(view);
    view = null;

    MyApp = null;
  }
});

test('should call a registered helper for mustache without parameters', function() {
  EmberHandlebars.registerHelper('foobar', function() {
    return 'foobar';
  });

  view = EmberView.create({
    template: compile('{{foobar}}')
  });

  appendView(view);

  ok(view.$().text() === 'foobar', 'Regular helper was invoked correctly');
});

test('should bind to the property if no registered helper found for a mustache without parameters', function() {
  view = EmberView.createWithMixins({
    template: compile('{{view.foobarProperty}}'),
    foobarProperty: computed(function() {
      return 'foobarProperty';
    })
  });

  appendView(view);

  ok(view.$().text() === 'foobarProperty', 'Property was bound to correctly');
});

test("should be able to update when bound property updates", function() {
  MyApp.set('controller', EmberObject.create({name: 'first'}));

  var View = EmberView.extend({
    template: compile('<i>{{view.value.name}}, {{view.computed}}</i>'),
    valueBinding: 'MyApp.controller',
    computed: computed(function() {
      return this.get('value.name') + ' - computed';
    }).property('value')
  });

  run(function() {
    view = View.create();
  });

  appendView(view);

  run(function() {
    MyApp.set('controller', EmberObject.create({
      name: 'second'
    }));
  });

  equal(view.get('computed'), "second - computed", "view computed properties correctly update");
  equal(view.$('i').text(), 'second, second - computed', "view rerenders when bound properties change");
});

test('should cleanup bound properties on rerender', function() {
  view = EmberView.create({
    controller: EmberObject.create({name: 'wycats'}),
    template: compile('{{name}}')
  });

  appendView(view);

  equal(view.$().text(), 'wycats', 'rendered binding');

  run(view, 'rerender');

  equal(view._childViews.length, 1);
});

test("should update bound values after view's parent is removed and then re-appended", function() {
  expectDeprecation("Setting `childViews` on a Container is deprecated.");

  var controller = EmberObject.create();

  var parentView = ContainerView.create({
    childViews: ['testView'],

    controller: controller,

    testView: EmberView.create({
      template: compile("{{#if showStuff}}{{boundValue}}{{else}}Not true.{{/if}}")
    })
  });

  controller.setProperties({
    showStuff: true,
    boundValue: "foo"
  });

  appendView(parentView);
  view = parentView.get('testView');

  equal(trim(view.$().text()), "foo");
  run(function() {
    set(controller, 'showStuff', false);
  });
  equal(trim(view.$().text()), "Not true.");

  run(function() {
    set(controller, 'showStuff', true);
  });
  equal(trim(view.$().text()), "foo");

  run(function() {
    parentView.remove();
    set(controller, 'showStuff', false);
  });
  run(function() {
    set(controller, 'showStuff', true);
  });
  appendView(parentView);

  run(function() {
    set(controller, 'boundValue', "bar");
  });
  equal(trim(view.$().text()), "bar");

  destroyView(parentView);
});

test('should accept bindings as a string or an Ember.Binding', function() {
  var viewClass = EmberView.extend({
    template: compile('binding: {{view.bindingTest}}, string: {{view.stringTest}}')
  });

  EmberHandlebars.registerHelper('boogie', function(id, options) {
    options.hash = options.hash || {};
    options.hash.bindingTestBinding = Binding.oneWay('context.' + id);
    options.hash.stringTestBinding = id;

    var result;
    if (Ember.FEATURES.isEnabled('ember-htmlbars')) {
      result = htmlbarsViewHelper.helper(viewClass, options.hash, options, options);
    } else {
      result = handlebarsViewHelper.helper(this, viewClass, options);
    }

    return result;
  });

  view = EmberView.create({
    context: EmberObject.create({
      direction: 'down'
    }),
    template: compile('{{boogie direction}}')
  });

  appendView(view);

  equal(trim(view.$().text()), 'binding: down, string: down');
});
