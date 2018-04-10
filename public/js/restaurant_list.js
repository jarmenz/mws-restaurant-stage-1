const APP_NAME = 'av-rr';

const MAP_API_KEY = 'AIzaSyCSPE2b5yv7k7CvRctNKvGl42FXfMr-DeU',
    STATIC_MAP_API_KEY = 'AIzaSyBC8fMCdTyXKxZmNEe6aMXOIoM6AR_Pgak';

// my signature
console.log(
    `%c ${APP_NAME} %c restaurant reviews `,
    'background: #2196F3; color: #fff; font-size: 12px; border-radius: 3px 0 0 3px; font-family: Tahoma;',
    'background: #bee1fd; color: #000; font-size: 12px; border-radius: 0 3px 3px 0; font-family: Tahoma;'
);
let restaurants = [],
  neighborhoods = [],
  cuisines = [],
  map,
  markers = [];

/**
 * Register service worker for caching static assets
 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', {
    scope: './'
  });

  navigator.serviceWorker.ready.then(swRegistration => {
    return swRegistration.sync.register('syncUp');
  });
}

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded
 */
document.addEventListener('DOMContentLoaded', event => {
  fetchNeighborhoods();
  fetchCuisines();
  updateRestaurants();
});

/**
 * Async add google map
 */
addGoogleMap = () => {
  let script = document.createElement('script');

  script.type = 'text/javascript';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${MAP_API_KEY}&callback=initMap`;
  document.body.appendChild(script);
};

/**
 * Fetch all neighborhoods and set their HTML
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) {
      // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
};

/**
 * Set neighborhoods HTML
 * @param {Array} neighborhoods
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
};

/**
 * Set cuisines HTML
 * @param {Array} cuisines
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
};

/**
 * Initialize Google map
 */
window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });

  if (typeof google !== 'undefined') addMarkersToMap();
};

/**
 * Update page and map for current restaurants
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) console.error(error);
    else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
      lazyLoadImages();
    }
  });
};

/**
 * Load page images after restaurant DOM has been added
 */
lazyLoadImages = () => {
  const observer = lozad();
  observer.observe();
};

/**
 * Clear current restaurants, their HTML and remove their map markers
 * @param {Array} restaurants - list of restaurants
 */
resetRestaurants = restaurants => {
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  if (self.markers && self.markers.length > 0) {
    self.markers.forEach(m => m.setMap(null));
    self.markers = [];
  }
  self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage
 * @param {Array} restaurants - list of restaurants
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const fragment = document.createDocumentFragment();
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    fragment.append(createRestaurantHTML(restaurant));
  });

  ul.appendChild(fragment);
};

/**
 * Create restaurant HTML
 * @param {Object} restaurant - restaurant
 */
createRestaurantHTML = restaurant => {
  const li = document.createElement('li');
  li.setAttribute('restaurant-id', restaurant.id);

  const image = document.createElement('img');
  image.className = 'restaurant-img lozad';
  image.setAttribute('data-src', DBHelper.imageUrlForRestaurant(restaurant));
  image.alt = `Restaurant ${restaurant.name} - cuisine ${restaurant.cuisine_type}`;
  li.append(image);

  const name = document.createElement('h2');
  name.classList.add('restaurant-name');
  name.innerHTML = restaurant.name;
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);

  const favToggle = document.createElement('span');
  favToggle.innerHTML = `&#x2605;`;
  favToggle.title = 'Favorite restaurant';
  favToggle.classList.add('favorite-restaurant');
  if (stringToBoolean(restaurant.is_favorite)) favToggle.classList.add('is-favorite');
  favToggle.addEventListener('click', event => {
    favoriteRestaurant(event.target, restaurant);
  });

  li.append(favToggle);

  return li;
};

/**
 * Add markers for current restaurants to the map
 * @param {Array} restaurants - list of restaurants
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url;
    });
    if (self.markers) self.markers.push(marker);
  });
};

/**
 * Favorite/unfavorite restaurant
 * @param {Object} target - event target
 * @param {Object} restaurant
 */
favoriteRestaurant = (target, restaurant) => {
  if (target.className.indexOf('is-favorite') > -1) {
    target.classList.remove('is-favorite');
    DBHelper.favoriteRestaurant(restaurant, false);
  } else {
    target.classList.add('is-favorite');
    DBHelper.favoriteRestaurant(restaurant, true);
  }
};

/**
 * Common database helper functions
 */
class DBHelper {
  /**
   * REST API location
   */
  static get REST_URL() {
    const port = 1337;
    return `http://localhost:${port}`;
  }

  /**
   * database name (= service worker name)
   */
  static get DB_NAME() {
    return APP_NAME;
  }

  /**
   * Indexed db store name for restaurants
   */
  static get STORE_RESTAURANTS() {
    return 'restaurants';
  }

  /**
   * Indexed db store name for reviews
   */
  static get STORE_REVIEWS() {
    return 'reviews';
  }

  /**
   * Indexed db version
   */
  static get DB_VER() {
    return 1;
  }

  /**
   * Get indexed database promise
   */
  static getDb() {
    return idb.open(DBHelper.DB_NAME, DBHelper.DB_VER, upgrade => {
      const storeRestaurants = upgrade.createObjectStore(DBHelper.STORE_RESTAURANTS, {
        keyPath: 'id'
      });

      //storeRestaurants.createIndex('by-id', 'id');

      const storeReviews = upgrade.createObjectStore(DBHelper.STORE_REVIEWS, {
        keyPath: 'id'
      });

      //storeReviews.createIndex('by-restaurant-id', 'restaurant_id');
    });
  }

  /**
   * Fetch all restaurants.
   * @param {Function} callback function to be triggered after restaurants are returned
   */
  static fetchRestaurants(callback) {
    DBHelper.getDb()
      .then(db => {
        if (!db) return;

        return db
          .transaction(DBHelper.STORE_RESTAURANTS)
          .objectStore(DBHelper.STORE_RESTAURANTS)
          .getAll();
      })
      .then(data => {
        // return idb restaurant data if found (up-to-date data)
        if (data && data.length > 0) return callback(null, data);
        else {
          fetch(`${DBHelper.REST_URL}/${DBHelper.STORE_RESTAURANTS}`)
            .then(resp => {
              if (resp.status !== 200)
                console.error(`Could not retrieve restaurants data. Status: ${response.status}`);
              else return resp.json();
            })
            .then(restaurants => {
              DBHelper.getDb().then(db => {
                if (!db) return;

                const store = db
                  .transaction(DBHelper.STORE_RESTAURANTS, 'readwrite')
                  .objectStore(DBHelper.STORE_RESTAURANTS);

                restaurants.map(restaurant => {
                  restaurant.pendingUpdate = false;
                  store.put(restaurant);
                });
              });
              return callback(null, restaurants);
            })
            .catch(err => console.error(`[${APP_NAME}] request failed: ${err}`));
        }
      });
  }

  /**
   * Fetch all restaurant reviews
   * @param {Function} callback function to be triggered after reviews are returned
   */
  static fetchReviews(callback) {
    DBHelper.getDb()
      .then(db => {
        if (!db) return;

        return db
          .transaction(DBHelper.STORE_REVIEWS)
          .objectStore(DBHelper.STORE_REVIEWS)
          .getAll();
      })
      .then(data => {
        // return idb restaurant data if found (up-to-date data)
        if (data && data.length > 0) return callback(null, data);
        else {
          fetch(`${DBHelper.REST_URL}/${DBHelper.STORE_REVIEWS}`)
            .then(resp => {
              if (resp.status !== 200)
                console.error(`Could not retrieve reviews data. Status: ${response.status}`);
              else return resp.json();
            })
            .then(reviews => {
              // save reviews to idb
              DBHelper.getDb()
                .then(db => {
                  if (!db) return;

                  const store = db
                    .transaction(DBHelper.STORE_REVIEWS, 'readwrite')
                    .objectStore(DBHelper.STORE_REVIEWS);

                  if (reviews && reviews.length > 0) {
                    reviews.map(review => {
                      review.pendingUpdate = false;
                      store.put(review);
                    });
                  }
                });

              return callback(null, reviews);
            });
        }
      })
      .catch(err => console.error(`[${APP_NAME}] exception in getting reviews: ${err}`));
  }

  /**
   * Fetch reviews by restaurant id
   * @param {String} id - id of restaurant
   * @param {Function} callback - callback function
   */
  static fetchReviewsByRestaurantId(id, callback) {
    DBHelper.fetchReviews((error, reviews) => {
      if (error)
        callback(error, null);
      else {
        const reviewsList = reviews.filter(review => review.restaurant_id == id);

        if (reviewsList)
          callback(null, reviewsList);
        else
          callback(`[${APP_NAME}] reviews for restaurant id '${id}' do not exist`, null);
      }
    });
  }

  /**
   * Fetch a restaurant by id
   * @param {String} id - id of restaurant
   * @param {Function} callback - callback function
   */
  static fetchRestaurantById(id, callback) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error)
        callback(error, null);
      else {
        const restaurant = restaurants.find(restaurant => restaurant.id == id);
        if (restaurant)
          callback(null, restaurant);
        else
          callback(`[${APP_NAME}] restaurant '${restaurant}' does not exist`, null);
      }
    });
  }

  /**
   * Fetch restaurants and filter by a cuisine type
   * @param {String} cuisine - type of cuisine to search for
   * @param {Function} callback - callback function
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error)
        callback(error, null);
      else
        callback(null, restaurants.filter(restaurant => restaurant.cuisine_type === cuisine));
    });
  }

  /**
   * Fetch restaurants and filter by a neighborhood
   * @param {String} neighborhood - type of neighborhood to search for
   * @param {Function} callback - callback function
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error)
        callback(error, null);
      else
        callback(null, restaurants.filter(restaurant => restaurant.neighborhood === neighborhood));
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood
   * @param {String} cuisine - type of cuisine to search for
   * @param {String} neighborhood - type of neighborhood to search for
   * @param {Function} callback - callback function
   */
  static fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    callback
  ) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error)
        callback(error, null);
      else {
        let results = restaurants;
        if (cuisine !== 'all') {
          // filter by cuisine
          results = results.filter(restaurant => restaurant.cuisine_type === cuisine);
        }
        if (neighborhood !== 'all') {
          // filter by neighborhood
          results = results.filter(restaurant => restaurant.neighborhood === neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods
   * @param {Function} callback - callback function
   */
  static fetchNeighborhoods(callback) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error)
        callback(error, null);
      else {
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) === i);

        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines
   * @param {Function} callback - callback function
   */
  static fetchCuisines(callback) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error)
        callback(error, null);
      else {
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) === i);
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Build restaurant page URL
   * @param {Object} restaurant - restaurant object to be used to fill url
   */
  static urlForRestaurant(restaurant) {
    return `./restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Build restaurant image URL
   * @param {Object} restaurant - restaurant object to be used to fill url
   */
  static imageUrlForRestaurant(restaurant) {
    return restaurant && restaurant.photograph ?
      `img/${restaurant.photograph}.webp` :
      'img/no-image.svg';
  }

  /**
   * Map marker for a restaurant
   * @param {Object} restaurant - restaurant object to be used to fill url
   * @param {Object} map - Google map object
   */
  static mapMarkerForRestaurant(restaurant, map) {
    return new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    });
  }

  /**
   * Favorite/unfavorite a restaurant
   * @param {String} id restaurant id
   * @param {Boolean} state true/false - favorite/unfavorite
   */
  static favoriteRestaurant(restaurant, state) {
    if (!restaurant || typeof state !== 'boolean') return;

    restaurant.is_favorite = state;

    fetch(`${DBHelper.REST_URL}/restaurants/${restaurant.id}/?is_favorite=${state}`, {
      method: 'PUT'
    }).then(resp => {
      if (resp.status != 200)
        console.info(`[${APP_NAME}] response was not successful. Response: ${resp}`);
    }).catch(e => {
      console.error(`[${APP_NAME}] put request failed. Could not ${state ? 'favorite' : 'unfavorite'} restaurant '${restaurant.id}'. Error: ${e}`);
    });

    // update idb record
    DBHelper.getDb().then(db => {
      if (!db) return;

      const store = db
        .transaction(DBHelper.STORE_RESTAURANTS, 'readwrite')
        .objectStore(DBHelper.STORE_RESTAURANTS);

      store.put(restaurant);
    });
  }
}

/**
 * Covert string to boolean
 * @param {any} str string variable (if other then evaluate if bool)
 */
stringToBoolean = str => {
  if (typeof str === 'string') {
    switch (str.toLowerCase().trim()) {
      case 'true':
      case 'yes':
      case '1':
        return true;
      case 'false':
      case 'no':
      case '0':
      case null:
        return false;
    }
  }

  return Boolean(str);
}
'use strict';

(function() {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function(resolve, reject) {
      request.onsuccess = function() {
        resolve(request.result);
      };

      request.onerror = function() {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function(resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function(value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function(prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function() {
          return this[targetProp][prop];
        },
        set: function(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', [
    'name',
    'keyPath',
    'multiEntry',
    'unique'
  ]);

  proxyRequestMethods(Index, '_index', IDBIndex, [
    'get',
    'getKey',
    'getAll',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, [
    'openCursor',
    'openKeyCursor'
  ]);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', [
    'direction',
    'key',
    'primaryKey',
    'value'
  ]);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
    'update',
    'delete'
  ]);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function() {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function() {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function(value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function() {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function() {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', [
    'name',
    'keyPath',
    'indexNames',
    'autoIncrement'
  ]);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'put',
    'add',
    'delete',
    'clear',
    'get',
    'getAll',
    'getKey',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'openCursor',
    'openKeyCursor'
  ]);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, [
    'deleteIndex'
  ]);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function(resolve, reject) {
      idbTransaction.oncomplete = function() {
        resolve();
      };
      idbTransaction.onerror = function() {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function() {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function() {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', [
    'objectStoreNames',
    'mode'
  ]);

  proxyMethods(Transaction, '_tx', IDBTransaction, [
    'abort'
  ]);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function() {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, [
    'deleteObjectStore',
    'close'
  ]);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function() {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(DB, '_db', IDBDatabase, [
    'close'
  ]);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
    [ObjectStore, Index].forEach(function(Constructor) {
      Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function() {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function(Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function(query, count) {
      var instance = this;
      var items = [];

      return new Promise(function(resolve) {
        instance.iterateCursor(query, function(cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor.continue();
        });
      });
    };
  });

  var exp = {
    open: function(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      request.onupgradeneeded = function(event) {
        if (upgradeCallback) {
          upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
        }
      };

      return p.then(function(db) {
        return new DB(db);
      });
    },
    delete: function(name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (typeof module !== 'undefined') {
    module.exports = exp;
    module.exports.default = module.exports;
  }
  else {
    self.idb = exp;
  }
}());
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.lozad=e()}(this,function(){"use strict";function t(t){t.setAttribute("data-loaded",!0)}var e=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},r=document.documentMode,n={rootMargin:"0px",threshold:0,load:function(t){if("picture"===t.nodeName.toLowerCase()){var e=document.createElement("img");r&&t.getAttribute("data-iesrc")&&(e.src=t.getAttribute("data-iesrc")),t.appendChild(e)}t.getAttribute("data-src")&&(t.src=t.getAttribute("data-src")),t.getAttribute("data-srcset")&&(t.srcset=t.getAttribute("data-srcset")),t.getAttribute("data-background-image")&&(t.style.backgroundImage="url("+t.getAttribute("data-background-image")+")")},loaded:function(){}},o=function(t){return"true"===t.getAttribute("data-loaded")},a=function(e,r){return function(n,a){n.forEach(function(n){n.intersectionRatio>0&&(a.unobserve(n.target),o(n.target)||(e(n.target),t(n.target),r(n.target)))})}},i=function(t){return t instanceof Element?[t]:t instanceof NodeList?t:document.querySelectorAll(t)};return function(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:".lozad",d=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},u=e({},n,d),c=u.rootMargin,s=u.threshold,g=u.load,f=u.loaded,l=void 0;return window.IntersectionObserver&&(l=new IntersectionObserver(a(g,f),{rootMargin:c,threshold:s})),{observe:function(){for(var e=i(r),n=0;n<e.length;n++)o(e[n])||(l?l.observe(e[n]):(g(e[n]),t(e[n]),f(e[n])))},triggerLoad:function(e){o(e)||(g(e),t(e),f(e))}}}});