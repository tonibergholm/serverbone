var testSetup = require('./test_setup');
var should = require('chai').should();
var assert = require('chai').assert;
var when = require('backbone-promises').when;
var TestCollection = testSetup.TestCollection;
var FailingCollection = testSetup.FailingCollection;

var TemplatedCollection = TestCollection.extend({
  defaultOptions: {
    where: {
      users: '{user_id}'
    }
  }
});

var PlatformCollection = TestCollection.extend({
  defaultOptions: {
    where: {
      foo: false,
      platforms: {
        $in: '{platforms}'
      }
    }
  }
});

describe('BaseCollection tests', function () {
  var testId;
  var collection = new TestCollection();

  before(function(next) {
    testSetup.setupDbs(function(err, dbs) {
      if (!testSetup.unitTesting) {
        testSetup.setDb(TestCollection, 'redis');
        testSetup.setDb(TestCollection.prototype.model, 'redis');
      }
      next();
    });
  });

  after(function(next) {
    testSetup.clearDb();
    next();
  });

  describe('Setup', function() {
    it('should create collection instance', function () {
      should.exist(collection.length);
      collection.length.should.equal(0);
    });

    it('should replace templated properties', function() {
      TemplatedCollection.prototype.defaultOptions.where.users.should.equal('{user_id}');
      var col = new TemplatedCollection([], {user_id: 1});
      col.defaultOptions.where.users.should.equal(1);
    });

    it('should setup default filtering options', function() {
      var col = new PlatformCollection(null, {platforms: ['android']});
      col.defaultOptions.where.platforms.$in[0].should.equal('android');
    });

    it('should get the url for collection', function() {
      var col = new PlatformCollection(null, {platforms: ['foo']});
      col.url.should.be.ok;
    });
  });

  describe('CRUD', function() {
    it('should create models', function() {
      // TODO: test create when failing validation
      return collection.create({test: '1', title: 'foo1'}).then(function(model) {
        model.id.should.be.ok;
      });
    });

    it('should create models and set templated values', function() {
      // TODO: test create when failing validation
      var collection2 = new TemplatedCollection(null, {user_id: 1});
      return collection2.create({test: '1', title: 'foo1'}).then(function(model) {
        model.id.should.be.ok;
        model.get('users').should.equal(1);
      });
    });

    it('should create another model', function() {
      return collection.create({test: '2', title: 'foo2'}).then(function(model) {
        collection.length.should.equal(2);
        model.id.should.be.ok;
      });
    });

    it('should fetch 3 models', function() {
      return collection.fetch().then(function() {
        collection.length.should.equal(3);
        testId = collection.at(2).id;
        testId.should.be.ok;
        collection.at(2).get('test').should.equal('2');
      });
    });

    it('should test collection toJSON', function() {
      var coll = new testSetup.TestCollection2();
      var m = new testSetup.TestModel2({title: 'foo', test: 'abc', id: 1});
      coll.add(m);
      var opts = coll.defaultProjectionOptions();
      should.exist(opts.projection.onlyFields);
      var json = coll.toJSON(opts);
      json.length.should.equal(1);
      should.not.exist(json[0].id);
    });

    it('should load models created through the collection', function() {
      var m = new collection.model({id: testId});
      return m.fetch().then( function() {
        m.get('id').should.equal(testId);
      });
    });

    it('should destroy model', function() {
      var m = collection.at(1);
      testId = m.id;
      return m
        .destroy()
        .then(function() {
          collection.length.should.equal(2);
        });
    });

    it('should verify that model was destroyed', function() {
      var m = new collection.model({id: testId});
      return m
        .fetch()
        .then(function() {
          return when.reject(new Error('Failed destroying'));
        }, function(err) {
          err.should.be.instanceOf(Error);
          return when.resolve();
        });
    });

    it('should fail creating if model preSave fails', function() {
      var coll = new FailingCollection();
      return coll
        .create()
        .then(function() {
          assert.ok(false);
          when.reject(new Error());
        }, function(err) {
          err.message.should.equal('foo reason');
          return when.resolve();
        });
    });

    it('should destroy all models from collection', function() {
      collection.length.should.equal(2);
      return collection
        .applyToAll('destroy')
        .then(function() {
          collection.length.should.equal(0);
        });
    });

    it('should check that models were removed', function() {
      return collection.fetch()
        .then(function() {
          collection.length.should.equal(0);
        });
    });
  });

});