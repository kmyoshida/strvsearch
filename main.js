var strava = require('strava-v3');
var express = require('express');
var session = require('express-session');
const MongoStore = require('connect-mongo')(session);
var path = require('path');
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var fs = require("fs");
var mongodb = require('mongodb');
//var qpm = require('query-params-mongo');

var mongodb_params = {
	"user" : "writer",
	"passwd" : "strv2016",
	"server" : "ds157819.mlab.com",
	"port" : "57819",
	"db" : "strvsearch"
}
var mongodb_connect = "mongodb://" + mongodb_params.user +
	":" + mongodb_params.passwd + "@" + mongodb_params.server +
	":" + mongodb_params.port + "/" + mongodb_params.db;


var app = express();

//app.use(express.favicon());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session(
{
    secret: "toto",
    name: "cookie_name",
  	store: new MongoStore({ url: mongodb_connect }),
  	cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
    //proxy: true,
    //resave: true,
    saveUninitialized: false
}));

//=================================================================================
// GET ALL ACTIVITIES FROM STRAVA
//=================================================================================


function get_all_activities(token, callback) {
	
	var all_activities = [];

	console.log("get_all_activities");
	_fetchpage(token, 1, all_activities, callback);

}

function _fetchpage(token, page_num, d, cb_end) {
	console.log("fetching... page " + page_num);
	strava.athlete.listActivities({'access_token': token, 'page':page_num, 'per_page':200}, function(err, payload) {
		if (err || payload.message != undefined) {
			console.log("fetching... ERROR");
			if (!err) {
				err = payload;
			}
			cb_end(err, d);

		} else if (payload == undefined || payload.length == 0) {
			console.log("fetching... DONE");
			cb_end(null, d);
		} else {
			var d1 = d.concat(payload);
			_fetchpage(token, page_num + 1, d1, cb_end);
		}
	});
}

app.get('/activities', function(req, res) {

	console.log("==> /activities");

	var sess = req.session;
	var token = sess.access_token;
	
	get_all_activities(token, function(err, d) { 
		if (err) {
			res.status(500).send(err);
		} else {
			res.setHeader('Content-Type', 'application/json');
			res.send(d);
		}
	});
});

//app.get('/activities_map', function(req, res) {
//    res.render('map.ejs');
//});



app.get('/clear', function(req, res) {

	console.log("==> /clear");

	var athlete_id = 4655228;
	console.log("athlete_id: " + athlete_id);

    mongodb.MongoClient.connect(mongodb_connect, function(err, db) {
    	if (err) {
    		console.log(err);
        	res.status(500).send(err);
        } else {
        	db.collection('activities').remove({'athlete.id': 4655228},  function(err, numberOfRemovedDocs) {
				console.log("removed " + numberOfRemovedDocs);
			});
        }
    });
});


app.get('/refresh', function(req, res) {

	console.log("==> /refresh");

	var sess = req.session;
	var token = sess.access_token;

	var mongodb_params = {
		"user" : "writer",
		"passwd" : "strv2016",
		"server" : "ds157819.mlab.com",
		"port" : "57819",
		"db" : "strvsearch"
	}
	var mongodb_connect = "mongodb://" + mongodb_params.user +
		":" + mongodb_params.passwd + "@" + mongodb_params.server +
		":" + mongodb_params.port + "/" + mongodb_params.db;

	if (!token || token == undefined) {
		res.redirect('/login');
	} else {
		get_all_activities(token, function(err, d) { 
			if (err) {
				res.status(500).send(err);
			} else {
				strava.athlete.get({'access_token': token}, function (err, results) {
					if(err) {
			    		console.log(err);
			        	res.status(500).send(err);
			        } else {

						var athlete_id = results.id;
						console.log("athlete_id: " + athlete_id);

					    mongodb.MongoClient.connect(mongodb_connect, function(err, db) {
					    	if(err) {
					    		console.log(err);
					        	res.status(500).send(err);
					        } else {
					        	db.collection('activities').remove({'athlete.id': athlete_id},  function(err, numberOfRemovedDocs) {
        							console.log("removed " + numberOfRemovedDocs);
        							db.collection('activities').insert(d, function (err, results) {
						        		if (err) {
						        			console.log(err)
						        			res.status(500).send(err);
						        		} else {
						        			console.log("db update done");
						        			res.redirect("/");
						        		}
					  				});
        						});
					        	
					        }
					    });
					}
				});
			}
		});
	}
});


//=================================================================================
// GET ACTIVITIES FROM MONGODB WEB SERVICE
//=================================================================================

app.get('/searchws', function(req, res) {

	//console.log("******* search0: req.query=");
	//console.log(req.query);

	console.log("==> /searchws");

	var q = { "name": { $regex: req.query['keyword'], $options: 'i' } };
	var mongodb_params = {
		"user" : "appuser",
		"passwd" : "strv2016",
		"server" : "ds157819.mlab.com",
		"port" : "57819",
		"db" : "strvsearch"
	}
	var mongodb_connect = "mongodb://" + mongodb_params.user +
		":" + mongodb_params.passwd + "@" + mongodb_params.server +
		":" + mongodb_params.port + "/" + mongodb_params.db;


    mongodb.MongoClient.connect(mongodb_connect, function(err, db) {
    	if(err) {
    		console.log(err);
        	res.status(500).send(err);
        } else {
        	res.setHeader('Content-Type', 'application/json');
        	db.collection('activities').find(q).toArray(function (err, results) {
        		if (err) {
        			console.log(err)
        			res.status(500).send(err);
        		} else {
        			//console.log("******* search0: " + results.length + " result(s)");
        			res.send(results);
        		}
  			});
        }
    });

});


//=================================================================================
// SEARCH (MAIN) PAGE
//=================================================================================

app.get('/', function(req, res) {

	console.log("==> /");

	res.redirect('/search');
});

app.get('/search', function(req, res) {

	console.log("==> /search");

	var sess = req.session;
	var token = sess.access_token;

	console.log("SESSION: " + token);

	if (!token || token == undefined) {
		res.redirect('/login');
	}
	else {
		strava.athlete.get({'access_token': token}, function (err, results) {
			//console.log(JSON.stringify(results));
			res.render('search.ejs', { 'athlete' : results});
		});


	}
});

//=================================================================================
// TEST PAGE
//=================================================================================

app.get('/test', function(req, res) {

	console.log("==> /test");

	var sess = req.session;
	var token = sess.access_token;

	console.log("SESSION: " + token);

	if (!token || token == undefined) {
		res.redirect('/login');
	}
	else {
		res.render('test.ejs', { 'token' : token});
	}
});




//=================================================================================
// LOGIN TO STRAVA
//=================================================================================

app.get('/login', function(req, res) {

	console.log("==> /login");
	

	res.sendFile(path.join(__dirname + '/public/login.html'));

});

app.get('/exchange', function(req, res) {

	console.log("==> /exchange");

	var sess = req.session;

	strava.oauth.getToken(req.query['code'], function (err, results) {
		if (err) {
			console.log("ERROR:" + JSON.stringify(err));
			res.status(500).send(err);
		} else {
			sess.code = req.query['code'];
			console.log("got token: " + results.access_token);
			sess.access_token = results.access_token;
			res.redirect('/search');
	  	}
	});

});

//=================================================================================

app.listen(process.env.PORT || 8080);