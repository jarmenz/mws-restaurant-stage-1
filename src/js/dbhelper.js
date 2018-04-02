/**
 * Common database helper functions.
 */
class DBHelper {
  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  /**
   * database name (= service worker name)
   */
  static get DB_NAME() {
    return 'av-rr';
  }

  /**
   * Indexed db store name
   */
  static get STORE_NAME() {
    return 'restaurants';
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
      const store = upgrade.createObjectStore(DBHelper.STORE_NAME, {
        keyPath: 'id'
      });

      store.createIndex('by-id', 'id');
    });
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    DBHelper.getDb()
      .then(db => {
        if (!db) return;

        return db
          .transaction(DBHelper.STORE_NAME)
          .objectStore(DBHelper.STORE_NAME)
          .getAll();
      })
      .then(data => {
        // idb restaurant data
        if (data && data.length > 0) return callback(null, data);
        else {
          fetch(DBHelper.DATABASE_URL)
            .then(resp => {
              if (resp.status !== 200)
                console.error(
                  `Could not retrieve restaurants data. Status:${
                    response.status
                  }`
                );
              else return resp.json();
            })
            .then(restaurants => {
              DBHelper.getDb().then(db => {
                if (!db) return;

                const store = db
                  .transaction(DBHelper.STORE_NAME, 'readwrite')
                  .objectStore(DBHelper.STORE_NAME);

                restaurants.map(r => store.put(r));
              });
              return callback(null, restaurants);
            })
            .catch(e => console.error(`Request failed. Returned error: ${e}`));
        }
      });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) {
          // Got the restaurant
          callback(null, restaurant);
        } else {
          // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    callback
  ) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != 'all') {
          // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') {
          // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map(
          (v, i) => restaurants[i].neighborhood
        );
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter(
          (v, i) => neighborhoods.indexOf(v) == i
        );
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter(
          (v, i) => cuisines.indexOf(v) == i
        );
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return `./restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return restaurant && restaurant.photograph ?
      `img/${restaurant.photograph}.webp` :
      'img/no-image.svg';
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    });
    return marker;
  }
}

// my signature
console.log(
  `%c AV-RR %c Andris Vilde: Restaurant Reviews `,
  'background: #2196F3; color: #fff; font-size: 12px; border-radius: 3px 0 0 3px; font-family: Tahoma;',
  'background: #bee1fd; color: #000; font-size: 12px; border-radius: 0 3px 3px 0; font-family: Tahoma;'
);