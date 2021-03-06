import Ember from 'ember-metal/core';
import Controller from 'ember-runtime/controllers/controller';
import run from 'ember-metal/run_loop';

import Application from 'ember-application/system/application';
import compile from 'ember-template-compiler/system/compile';
import helpers from 'ember-htmlbars/helpers';
import { OutletView } from 'ember-routing-views/views/outlet';
import Component from 'ember-views/components/component';
import jQuery from 'ember-views/system/jquery';
import { A as emberA } from 'ember-runtime/system/native_array';

var App, registry, container;
var originalHelpers;

const keys = Object.keys;

function prepare() {
  Ember.TEMPLATES['components/expand-it'] = compile('<p>hello {{yield}}</p>');
  Ember.TEMPLATES.application = compile('Hello world {{#expand-it}}world{{/expand-it}}');

  originalHelpers = emberA(keys(helpers));
}

function cleanup() {
  run(function() {
    if (App) {
      App.destroy();
    }
    App = null;
    Ember.TEMPLATES = {};

    cleanupHelpers();
  });
}

function cleanupHelpers() {
  var currentHelpers = emberA(keys(helpers));

  currentHelpers.forEach(function(name) {
    if (!originalHelpers.contains(name)) {
      delete helpers[name];
    }
  });
}

QUnit.module('Application Lifecycle - Component Registration', {
  setup: prepare,
  teardown: cleanup
});

function boot(callback, startURL='/') {
  run(function() {
    App = Application.create({
      name: 'App',
      rootElement: '#qunit-fixture'
    });

    App.deferReadiness();

    App.Router = Ember.Router.extend({
      location: 'none'
    });

    registry = App.__registry__;
    container = App.__container__;

    if (callback) { callback(); }
  });

  var router = container.lookup('router:main');

  run(App, 'advanceReadiness');
  run(function() {
    router.handleURL(startURL);
  });
}

QUnit.test('The helper becomes the body of the component', function() {
  boot();
  equal(jQuery('div.ember-view > div.ember-view', '#qunit-fixture').text(), 'hello world', 'The component is composed correctly');
});

QUnit.test('If a component is registered, it is used', function() {
  boot(function() {
    registry.register('component:expand-it', Component.extend({
      classNames: 'testing123'
    }));
  });

  equal(jQuery('div.testing123', '#qunit-fixture').text(), 'hello world', 'The component is composed correctly');
});


QUnit.test('Late-registered components can be rendered with custom `layout` property', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>there goes {{my-hero}}</div>');

  boot(function() {
    registry.register('component:my-hero', Component.extend({
      classNames: 'testing123',
      layout: compile('watch him as he GOES')
    }));
  });

  equal(jQuery('#wrapper').text(), 'there goes watch him as he GOES', 'The component is composed correctly');
  ok(!helpers['my-hero'], 'Component wasn\'t saved to global helpers hash');
});

QUnit.test('Late-registered components can be rendered with template registered on the container', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>hello world {{sally-rutherford}}-{{#sally-rutherford}}!!!{{/sally-rutherford}}</div>');

  boot(function() {
    registry.register('template:components/sally-rutherford', compile('funkytowny{{yield}}'));
    registry.register('component:sally-rutherford', Component);
  });

  equal(jQuery('#wrapper').text(), 'hello world funkytowny-funkytowny!!!', 'The component is composed correctly');
  ok(!helpers['sally-rutherford'], 'Component wasn\'t saved to global helpers hash');
});

QUnit.test('Late-registered components can be rendered with ONLY the template registered on the container', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>hello world {{borf-snorlax}}-{{#borf-snorlax}}!!!{{/borf-snorlax}}</div>');

  boot(function() {
    registry.register('template:components/borf-snorlax', compile('goodfreakingTIMES{{yield}}'));
  });

  equal(jQuery('#wrapper').text(), 'hello world goodfreakingTIMES-goodfreakingTIMES!!!', 'The component is composed correctly');
  ok(!helpers['borf-snorlax'], 'Component wasn\'t saved to global helpers hash');
});

QUnit.test('Component-like invocations are treated as bound paths if neither template nor component are registered on the container', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{user-name}} hello {{api-key}} world</div>');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'user-name': 'machty'
    }));
  });

  equal(jQuery('#wrapper').text(), 'machty hello  world', 'The component is composed correctly');
});

QUnit.test('Assigning layoutName to a component should setup the template as a layout', function() {
  expect(1);

  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#my-component}}{{text}}{{/my-component}}</div>');
  Ember.TEMPLATES['foo-bar-baz'] = compile('{{text}}-{{yield}}');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'text': 'outer'
    }));

    registry.register('component:my-component', Component.extend({
      text: 'inner',
      layoutName: 'foo-bar-baz'
    }));
  });

  equal(jQuery('#wrapper').text(), 'inner-outer', 'The component is composed correctly');
});

QUnit.test('Assigning layoutName and layout to a component should use the `layout` value', function() {
  expect(1);

  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#my-component}}{{text}}{{/my-component}}</div>');
  Ember.TEMPLATES['foo-bar-baz'] = compile('No way!');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'text': 'outer'
    }));

    registry.register('component:my-component', Component.extend({
      text: 'inner',
      layoutName: 'foo-bar-baz',
      layout: compile('{{text}}-{{yield}}')
    }));
  });

  equal(jQuery('#wrapper').text(), 'inner-outer', 'The component is composed correctly');
});

QUnit.test('Assigning defaultLayout to a component should set it up as a layout if no layout was found [DEPRECATED]', function() {
  expect(2);

  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#my-component}}{{text}}{{/my-component}}</div>');

  expectDeprecation(function() {
    boot(function() {
      registry.register('controller:application', Controller.extend({
        'text': 'outer'
      }));

      registry.register('component:my-component', Component.extend({
        text: 'inner',
        defaultLayout: compile('{{text}}-{{yield}}')
      }));
    });
  }, /Specifying `defaultLayout` to .+ is deprecated\./);

  equal(jQuery('#wrapper').text(), 'inner-outer', 'The component is composed correctly');
});

QUnit.test('Assigning defaultLayout to a component should set it up as a layout if layout was found [DEPRECATED]', function() {
  expect(2);

  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#my-component}}{{text}}{{/my-component}}</div>');
  Ember.TEMPLATES['components/my-component'] = compile('{{text}}-{{yield}}');

  expectDeprecation(function() {
    boot(function() {
      registry.register('controller:application', Controller.extend({
        'text': 'outer'
      }));

      registry.register('component:my-component', Component.extend({
        text: 'inner',
        defaultLayout: compile('should not see this!')
      }));
    });
  }, /Specifying `defaultLayout` to .+ is deprecated\./);

  equal(jQuery('#wrapper').text(), 'inner-outer', 'The component is composed correctly');
});

QUnit.test('Using name of component that does not exist', function () {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#no-good}} {{/no-good}}</div>');

  expectAssertion(function () {
    boot();
  }, /A helper named 'no-good' could not be found/);
});

QUnit.module('Application Lifecycle - Component Context', {
  setup: prepare,
  teardown: cleanup
});

QUnit.test('Components with a block should have the proper content when a template is provided', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#my-component}}{{text}}{{/my-component}}</div>');
  Ember.TEMPLATES['components/my-component'] = compile('{{text}}-{{yield}}');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'text': 'outer'
    }));

    registry.register('component:my-component', Component.extend({
      text: 'inner'
    }));
  });

  equal(jQuery('#wrapper').text(), 'inner-outer', 'The component is composed correctly');
});

QUnit.test('Components with a block should yield the proper content without a template provided', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#my-component}}{{text}}{{/my-component}}</div>');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'text': 'outer'
    }));

    registry.register('component:my-component', Component.extend({
      text: 'inner'
    }));
  });

  equal(jQuery('#wrapper').text(), 'outer', 'The component is composed correctly');
});

QUnit.test('Components without a block should have the proper content when a template is provided', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{my-component}}</div>');
  Ember.TEMPLATES['components/my-component'] = compile('{{text}}');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'text': 'outer'
    }));

    registry.register('component:my-component', Component.extend({
      text: 'inner'
    }));
  });

  equal(jQuery('#wrapper').text(), 'inner', 'The component is composed correctly');
});

QUnit.test('Components without a block should have the proper content', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{my-component}}</div>');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'text': 'outer'
    }));

    registry.register('component:my-component', Component.extend({
      didInsertElement() {
        this.$().html('Some text inserted by jQuery');
      }
    }));
  });

  equal(jQuery('#wrapper').text(), 'Some text inserted by jQuery', 'The component is composed correctly');
});

// The test following this one is the non-deprecated version
QUnit.test('properties of a component without a template should not collide with internal structures [DEPRECATED]', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{my-component data=foo}}</div>');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'text': 'outer',
      'foo': 'Some text inserted by jQuery'
    }));

    registry.register('component:my-component', Component.extend({
      didInsertElement() {
        this.$().html(this.get('data'));
      }
    }));
  });

  equal(jQuery('#wrapper').text(), 'Some text inserted by jQuery', 'The component is composed correctly');
});

QUnit.test('attrs property of a component without a template should not collide with internal structures', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{my-component attrs=foo}}</div>');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      'text': 'outer',
      'foo': 'Some text inserted by jQuery'
    }));

    registry.register('component:my-component', Component.extend({
      didInsertElement() {
        // FIXME: I'm unsure if this is even the right way to access attrs
        this.$().html(this.get('attrs.attrs.value'));
      }
    }));
  });

  equal(jQuery('#wrapper').text(), 'Some text inserted by jQuery', 'The component is composed correctly');
});

QUnit.test('Components trigger actions in the parents context when called from within a block', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#my-component}}<a href=\'#\' id=\'fizzbuzz\' {{action \'fizzbuzz\'}}>Fizzbuzz</a>{{/my-component}}</div>');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      actions: {
        fizzbuzz() {
          ok(true, 'action triggered on parent');
        }
      }
    }));

    registry.register('component:my-component', Component.extend());
  });

  run(function() {
    jQuery('#fizzbuzz', '#wrapper').click();
  });
});

QUnit.test('Components trigger actions in the components context when called from within its template', function() {
  Ember.TEMPLATES.application = compile('<div id=\'wrapper\'>{{#my-component}}{{text}}{{/my-component}}</div>');
  Ember.TEMPLATES['components/my-component'] = compile('<a href=\'#\' id=\'fizzbuzz\' {{action \'fizzbuzz\'}}>Fizzbuzz</a>');

  boot(function() {
    registry.register('controller:application', Controller.extend({
      actions: {
        fizzbuzz() {
          ok(false, 'action triggered on the wrong context');
        }
      }
    }));

    registry.register('component:my-component', Component.extend({
      actions: {
        fizzbuzz() {
          ok(true, 'action triggered on component');
        }
      }
    }));
  });

  jQuery('#fizzbuzz', '#wrapper').click();
});

QUnit.test('Components receive the top-level view as their ownerView', function(assert) {
  Ember.TEMPLATES.application = compile('{{outlet}}');
  Ember.TEMPLATES.index = compile('{{my-component}}');
  Ember.TEMPLATES['components/my-component'] = compile('<div></div>');

  let component;

  boot(function() {
    registry.register('component:my-component', Component.extend({
      init() {
        this._super();
        component = this;
      }
    }));
  });

  // Theses tests are intended to catch a regression where the owner view was
  // not configured properly. Future refactors may break these tests, which
  // should not be considered a breaking change to public APIs.
  let ownerView = component.ownerView;
  assert.ok(ownerView, 'owner view was set');
  assert.ok(ownerView instanceof OutletView, 'owner view has no parent view');
  assert.notStrictEqual(component, ownerView, 'owner view is not itself');

  assert.ok(ownerView._outlets, 'owner view has an internal array of outlets');
});
