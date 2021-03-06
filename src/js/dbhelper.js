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
        keyPath: 'id',
        autoIncrement: true
      });
      // values for pendingUpdate 'yes', 'no' are used instead of boolean because IndexedDb doesn't support index on boolean column
      // due to many possible 'falsy' values
      storeRestaurants.createIndex('pending-updates', 'pendingUpdate', {
        unique: false
      });

      const storeReviews = upgrade.createObjectStore(DBHelper.STORE_REVIEWS, {
        keyPath: 'id',
        autoIncrement: true
      });

      storeReviews.createIndex('pending-updates', 'pendingUpdate', {
        unique: false
      });
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
              if (resp.status !== 200) console.error(`Could not retrieve restaurants data. Status: ${response.status}`);
              else return resp.json();
            })
            .then(restaurants => {
              DBHelper.getDb().then(db => {
                if (!db) return;

                const store = db.transaction(DBHelper.STORE_RESTAURANTS, 'readwrite').objectStore(DBHelper.STORE_RESTAURANTS);

                restaurants.map(restaurant => {
                  if (!restaurant.hasOwnProperty('pendingUpdate')) restaurant.pendingUpdate = 'no';
                  store.put(restaurant);
                });
              });
              return callback(null, restaurants);
            })
            .catch(err => d(`request failed: ${err}`));
        }
      });
  }

  /**
   * Fetch restaurant reviews by id
   * @param {String} restaurantId
   * @param {Function} callback function to be triggered after reviews are returned
   */
  static fetchReviewsById(restaurantId, callback) {
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
        data = data.filter(review => review.restaurant_id === restaurantId);

        if (data && data.length > 0) return callback(null, data);
        else {
          fetch(`${DBHelper.REST_URL}/${DBHelper.STORE_REVIEWS}/?restaurant_id=${restaurantId}`)
            .then(resp => {
              if (resp.status !== 200) console.error(`Could not retrieve reviews data. Status: ${response.status}`);
              else return resp.json();
            })
            .then(reviews => {
              // tranform reviews
              if (reviews && reviews.length > 0) {
                reviews.map(review => {
                  if (!review.hasOwnProperty('pendingUpdate')) review.pendingUpdate = 'no';
                  review.createdAt = new Date(review.createdAt).valueOf();
                  review.updatedAt = new Date(review.updatedAt).valueOf();
                });
              }

              // save reviews to idb
              DBHelper.getDb().then(db => {
                if (!db) return;

                const store = db.transaction(DBHelper.STORE_REVIEWS, 'readwrite').objectStore(DBHelper.STORE_REVIEWS);

                if (reviews && reviews.length > 0) {
                  reviews.map(review => {
                    store.put(review);
                  });
                }
              });

              return callback(null, reviews);
            });
        }
      })
      .catch(err => d(`exception in getting reviews: ${err}`));
  }

  /**
   * Fetch reviews by restaurant id
   * @param {String} id - id of restaurant
   * @param {Function} callback - callback function
   */
  static fetchReviewsByRestaurantId(id, callback) {
    DBHelper.fetchReviewsById(id, (error, reviews) => {
      if (error) callback(error, null);
      else {
        const reviewsList = reviews; //.filter(review => review.restaurant_id == id);

        if (reviewsList) callback(null, reviewsList);
        else callback(`[${APP_NAME}] reviews for restaurant id '${id}' do not exist`, null);
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
      if (error) callback(error, null);
      else {
        const restaurant = restaurants.find(restaurant => restaurant.id == id);
        if (restaurant) callback(null, restaurant);
        else callback(`[${APP_NAME}] restaurant '${restaurant}' does not exist`, null);
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
      if (error) callback(error, null);
      else callback(null, restaurants.filter(restaurant => restaurant.cuisine_type === cuisine));
    });
  }

  /**
   * Fetch restaurants and filter by a neighborhood
   * @param {String} neighborhood - type of neighborhood to search for
   * @param {Function} callback - callback function
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) callback(error, null);
      else callback(null, restaurants.filter(restaurant => restaurant.neighborhood === neighborhood));
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood
   * @param {String} cuisine - type of cuisine to search for
   * @param {String} neighborhood - type of neighborhood to search for
   * @param {Function} callback - callback function
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) callback(error, null);
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
      if (error) callback(error, null);
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
      if (error) callback(error, null);
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
    return restaurant && restaurant.photograph ? `img/${restaurant.photograph}.webp` : 'img/no-image.svg';
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
      })
      .then(resp => {
        if (resp.status != 200) console.info(`[${APP_NAME}] response was not successful. Response: ${resp}`);
        restaurant.pendingUpdate = 'no';
      })
      .catch(e => {
        d(`put request failed. Could not ${state ? 'favorite' : 'unfavorite'} restaurant '${restaurant.id}'. Error: ${e}`);
        restaurant.pendingUpdate = 'yes';
      });

    DBHelper.updateRestaurantInDb(restaurant);
  }

  /**
   * Update idb restaurant record
   * @param {Object} restaurant
   * @param {Function} callback - callback function, *optional
   */
  static updateRestaurantInDb(restaurant, callback) {
    DBHelper.getDb().then(db => {
      if (!db) return;
      db.transaction(DBHelper.STORE_RESTAURANTS, 'readwrite').objectStore(DBHelper.STORE_RESTAURANTS).put(restaurant);
      if (typeof callback === 'function') callback();
    });
  }

  /**
   * Post user review to server and insert in db
   * @param {Object} review
   */
  static insertReview(review) {
    if (!review) return;

    if (review.hasOwnProperty('id'))
      delete review.id;

    fetch(`${DBHelper.REST_URL}/reviews`, {
        method: 'POST',
        body: JSON.stringify(review)
      })
      .then(resp => {
        if (resp.status != 201) {
          d(`response was not successful. Response: ${resp}`);
          review.pendingUpdate = 'yes';
        }
        return resp.json();
      })
      .then(rev => {
        // tranform review before insert
        if (!rev.hasOwnProperty('pendingUpdate'))
          rev.pendingUpdate = 'no';

        rev.createdAt = new Date(rev.createdAt).valueOf();
        rev.updatedAt = new Date(rev.updatedAt).valueOf();

        review = rev;

        DBHelper.insertReviewInDb(rev, () => {
          d('server record inserted', rev.id);
        });
      })
      .catch(err => {
        d(`post review request failed. Error: ${err}`);
        review.pendingUpdate = 'yes';
        // insert temporary idb record
        DBHelper.insertReviewInDb(review, () => {
          d('pending record inserted', review);
          review = review;
        });

        return review;
      })

    return review;
  }

  /**
   * Insert new db review
   * @param {Object} review 
   * @param {Function} callback *optional
   */
  static insertReviewInDb(review, callback) {
    DBHelper.getDb()
      .then(db => {
        if (!db) return;
        db.transaction(DBHelper.STORE_REVIEWS, 'readwrite').objectStore(DBHelper.STORE_REVIEWS).put(review);
        if (typeof callback === 'function') callback();
      })
      .catch(err => {
        d(`insert review in db failed. Error: ${err}`);
      });
  }

  /**
   * Delete a review from database
   * @param {String} reviewId
   * @param {Function} callback *optional
   */
  static deleteReviewFromDb(reviewId, callback) {
    DBHelper.getDb()
      .then(db => {
        if (!db) return;
        db.transaction(DBHelper.STORE_REVIEWS, 'readwrite').objectStore(DBHelper.STORE_REVIEWS).delete(reviewId);
        d(`review ${reviewId} deleted`);
        if (typeof callback === 'function') callback();
      })
      .catch(err => {
        d(`delete review from db failed. Error: ${err}`);
      });
  }

  /**
   * Sync database data (restaurants & reviews)
   */
  static syncData() {
    // restaurants
    DBHelper.getDb()
      .then(db => {
        if (!db) return;

        return db
          .transaction(DBHelper.STORE_RESTAURANTS)
          .objectStore(DBHelper.STORE_RESTAURANTS)
          .index('pending-updates').openCursor('yes');
      })
      .then(function iterateCursor(cursor) {
        if (!cursor) return;

        let restaurant = cursor.value;
        restaurant.pendingUpdate = 'no';
        DBHelper.favoriteRestaurant(restaurant, restaurant.is_favorite);

        return cursor.continue().then(iterateCursor);
      });

    // reviews
    DBHelper.getDb()
      .then(db => {
        if (!db) return;

        return db
          .transaction(DBHelper.STORE_REVIEWS)
          .objectStore(DBHelper.STORE_REVIEWS)
          .index('pending-updates').openCursor('yes');
      })
      .then(function iterateCursor(cursor) {
        if (!cursor) return;

        let review = cursor.value;

        DBHelper.deleteReviewFromDb(review.id, () => {
          review.pendingUpdate = 'no';
          DBHelper.insertReview(review);
        });

        return cursor.continue().then(iterateCursor);
      });
  }
}