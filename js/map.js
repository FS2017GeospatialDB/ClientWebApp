var map = (function() {

	// Private Variables
	var infoWindow = document.getElementById('info_window');
	var iw_form = document.getElementById('iw_form_parent');	
	var map = null;
	var properties = null;
	var geojson = L.geoJson([], {
		style: 	{	"color": "#ff7800",
   						"weight": 5,
							"opacity": 0.65
			},
		onEachFeature: popupWindow,
		pointToLayer: function(feature, latlng) {
			return L.marker(latlng, {icon: orangeIcon});
		},
		}).on('layeradd', function(e) { lastLayer = e.layer; });
	var selectedLayer = L.geoJson([], {
		style: 	{	"color": "#00ff00",
   						"weight": 5,
							"opacity": 0.65
		},
		pointToLayer: function(feature, latlng) {
			return L.marker(latlng, {icon: greenIcon});
		},
		});
	var editingLayers = L.geoJson([], {
		style: 	{	"weight": 5,
							"opacity": 0.65
		},
		onEachFeature: popupWindow,
		pointToLayer: function(feature, latlng) {
			return L.marker(latlng, {icon: blueIcon});
		},
		}).on('layeradd', function(e) { lastLayer = e.layer; });
	var lastFeature = null;
	var lastLayer = null;

	function initMap() {
		// Create the Map
		map = L.map('map', {
			center: [39.7488835, -105.2167468],
			zoom: 15,
		});
		L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
	    	attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
	    	maxZoom: 22,
    		id: 'mapbox.streets',
		    accessToken: 'pk.eyJ1IjoidHdhbGtlcjE0NjQiLCJhIjoiY2ozZzN0bHA2MDF4ZDJxb2lpdTc0OXBodSJ9.cRI1-1g_vdffzX2jG3aY8A'
		}).addTo(map);

		// draw toolbar
		map.addControl(new L.Control.Draw({
			draw: {
				circle: false
		}}));

		// when new shape finished
		map.on(L.Draw.Event.CREATED, function (e) {
			// dehighlight last feature
			if (!(lastFeature === null)) {
				if (lastFeature.hasOwnProperty('id')) { geojson.addData(lastFeature); }
				else { editingLayers.addData(lastFeature); }
			}

			// Opens an empty properties panel
			infoWindow.style.display = "";
			iw_form.innerHTML = "";
			properties = [];

			// highlight this feature
			lastFeature = e.layer.toGeoJSON();
			selectedLayer.clearLayers();
			selectedLayer.addData(lastFeature);
		});

		geojson.addTo(map);
		selectedLayer.addTo(map);
		editingLayers.addTo(map);
	}

	function submitPointQuery() {
		// queries a single s2cell

		var date = document.getElementById('calendar').value;
		timestamp = new Date(date);
		timestamp.setHours(document.getElementById('ts_hours').value);
		timestamp.setMinutes(document.getElementById('ts_minutes').value);
		timestamp.setSeconds(document.getElementById('ts_seconds').value);
		console.log(timestamp.getTime());

		var center = map.getCenter();
		var lat = center.lat;
		var lng = center.lng;

		var transport = new Thrift.TXHRTransport("http://localhost:8000/service");
		var protocol = new Thrift.TJSONProtocol(transport);
		var client = new GeolocationServiceClient(protocol);
		var result = client.getCell(lat, lng, Date.now() /*timestamp.getTime()*/);

		// Clear the Map
		geojson.clearLayers();
		
		// Add new GeoJSON's to Map
		for (var i = 0; i < result.length; i++) {
			json = JSON.parse(result[i].json);

			// GeoJSON Formatting Hack
			for (var j = 0; j < json.geometry.coordinates.length; j++) {
				if (json.geometry.type === 'LineString' && json.geometry.coordinates[j].length > 2)
					json.geometry.coordinates[j] = json.geometry.coordinates[j].slice(0, 2);
				for (var k = 0; k < json.geometry.coordinates[j].length; k++)
					if (json.geometry.type === 'Polygon' && json.geometry.coordinates[j][k].length > 2)
						json.geometry.coordinates[j][k] = json.geometry.coordinates[j][k].slice(0, 2);
			}

			console.log(JSON.stringify(json));
			json.id = json.properties.osm_id;
			geojson.addData(json);
		}
	}

	function submitRegionQuery() {
		// queries entire screen
		
		// checks for historical query
		if (document.getElementById('hqToggle').children[0].checked) {
			var date = document.getElementById('calendar').value;
			timestamp = new Date(date);
			timestamp.setHours(document.getElementById('ts_hours').value);
			timestamp.setMinutes(document.getElementById('ts_minutes').value);
			timestamp.setSeconds(document.getElementById('ts_seconds').value);
			time = timestamp.getTime();
		} else { time = Date.now(); }
		console.log(time);

		var bounds = map.getBounds();
		var east = bounds.getEast();
		var west = bounds.getWest();
		var north = bounds.getNorth();
		var south = bounds.getSouth();

		var transport = new Thrift.TXHRTransport("http://localhost:8000/service");
		var protocol = new Thrift.TJSONProtocol(transport);
		var client = new GeolocationServiceClient(protocol);
		var result = client.getFeatures(west, east, south, north, time);

		// Clear the Map
		geojson.clearLayers();

		// Add new GeoJSON's to Map
		for (var i = 0; i < result.length; i++) {
			json = JSON.parse(result[i].json);

			// GeoJSON Formatting Hack
			for (var j = 0; j < json.geometry.coordinates.length; j++) {
				if (json.geometry.type === 'LineString' && json.geometry.coordinates[j].length > 2)
					json.geometry.coordinates[j] = json.geometry.coordinates[j].slice(0, 2);
				for (var k = 0; k < json.geometry.coordinates[j].length; k++)
					if (json.geometry.type === 'Polygon' && json.geometry.coordinates[j][k].length > 2)
						json.geometry.coordinates[j][k] = json.geometry.coordinates[j][k].slice(0, 2);
			}
			json.id = json.geometry.type + '/' + json.properties.osm_id;
			geojson.addData(json);
		}
	}

	function popupWindow(feature, layer) {
		layer.on('click', function (e) {
			// dehighlight last feature
			if (!(lastFeature === null)) {
				if (lastFeature.hasOwnProperty('id')) { geojson.addData(lastFeature); }
				else { editingLayers.addData(lastFeature); }
			}

			lastFeature = feature;
			lastLayer = layer;

			// create info panel
			infoWindow.style.display = "";
			iw_form.innerHTML = "<div class='row'><div class='form-group'><div class='col-md-4 col-sm-12'><span for='osm_id' class='label label-primary'>OSM ID</span></div><div class='col-md-8 col-sm-12'><input type='text' name='osm_id' id='osm_id' class='form-control' value="
				+ feature.id + " disabled></div></div>";
			properties = [];

			for (var key in feature.properties) {
				if (feature.properties.hasOwnProperty(key)) {
					properties.push(key);
					hide = (feature.properties[key] === null) ? "style='display: none'" : "";
					$("#iw_form_parent").append("<div class='row'><div class='form-group' " + hide + "><div class='col-md-4 col-sm-12'><span for='"
						+ key +"' class='label label-info'>" + key 
						+ "</span></div><div class='col-md-8 col-sm-12'><input type='text' class='form-control' name='"
						+ key + "' id='" + key + "' value='" + feature.properties[key] + "'></div></div>");
				}
			}

			// highlight this feature
			selectedLayer.clearLayers();
			editingLayers.removeLayer(layer);
			geojson.removeLayer(layer);
			selectedLayer.addData(feature);
		});
	}

	function addProperty() {
		// adds new value to properties panel for more custom features
		var key = prompt("New property:", "key");
		if (properties.indexOf(key) > -1) {
			var field = document.getElementById(key);
			if (field.value == "null") {		// show the null field
				field.value = "";
				field.parentElement.parentElement.style.display = "";
				document.getElementById(key).focus();
				document.getElementById(key).select()
			}
			return;	// if key already in properties, don't add
		}
		properties.push(key);
		$("#iw_form_parent").append("<div class='row'><div class='form-group'><div class='col-md-4 col-sm-12'><span for='"
			+ key + "' class='label label-info'>" + key 
			+ "</span></div><div class='col-md-8 col-sm-12'><input type='text' class='form-control' name='"
			+ key + "' id='" + key + "' placeholder='value'></div></div>");
		document.getElementById(key).focus();
		document.getElementById(key).select()
	}
	
	function deleteFeature() {
		if (lastFeature.hasOwnProperty('id')) {
			// send feature id to thrift for deletion TODO: TEST / FINISH ERROR HANDLING
			console.log("to thrift: delete " + lastFeature.id);
			var transport = new Thrift.TXHRTransport("http://localhost:8000/service");
			var protocol = new Thrift.TJSONProtocol(transport);
			var client = new GeolocationServiceClient(protocol);
			var status = client.deleteFeature(lastFeature.id);
		}

		// hide panel and remove feature from all layers
		cancel('info_window');
		selectedLayer.clearLayers();
		editingLayers.removeLayer(lastLayer);
		geojson.removeLayer(lastLayer);
		lastLayer = lastFeature = null;		
	}

	function editFeature() {
		// hide panel and remove feature from layers
		editingLayers.removeLayer(lastLayer);
		geojson.removeLayer(lastLayer);
		cancel('info_window');

		// read all boxes in to new geoJSON
		var newFeatureProperties = {};
		for (var i = 1; i < iw_form.elements.length; i++) { //skips first element (osm_id)
			newFeatureProperties[iw_form.elements[i].id] = (iw_form.elements[i].value == "null") ? null : iw_form.elements[i].value;
		}
		var oldFeatureProperties = lastFeature.properties;

		// set up thrift
		var transport = new Thrift.TXHRTransport("http://localhost:8000/service");
		var protocol = new Thrift.TJSONProtocol(transport);
		var client = new GeolocationServiceClient(protocol);

		// feature starts with base of old feature, with new properties
		var feature = lastFeature;
		feature.properties = newFeatureProperties;

		if (!lastFeature.hasOwnProperty('id')) {	// NEW FEATURE
			// send new feature to thrift for processing TODO: TEST							
			console.log("to thrift: add " + JSON.stringify(feature));
			var id = client.updateFeature("new", JSON.stringify(feature));
//			var id = 1; // TEMP TODO REMOVE
			if (id != "failure") {
				feature.id = id;
				geojson.addData(feature);
			} else {	// failure code
				editingLayers.addData(feature);
			}
			console.log(id);
		} else if (JSON.stringify(newFeatureProperties) != JSON.stringify(oldFeatureProperties)) {	// EDIT FEATURE
			// send edited feature to thrift for processing TODO: TEST
			console.log("to thrift: update " + feature.id + " to " + JSON.stringify(feature));
			var id = client.updateFeature(lastFeature.id, JSON.stringify(feature));
//			var id = feature.id; // TEMP TODO REMOVE
			if (id == feature.id) {
				geojson.addData(feature);
			} else {	// failure code from thrift
				feature.properties = oldFeatureProperties; // revert property changes
				geojson.addData(feature);
			}
		} else {		// NO CHANGE
			geojson.addData(feature);
		}

		// de-highlight
		selectedLayer.clearLayers();
		lastLayer = lastFeature = null;
	}

	function cancelAdd() {
		// de-highlights
		selectedLayer.clearLayers();
		if (lastFeature.hasOwnProperty('id')) { geojson.addData(lastFeature); }
		else { editingLayers.addData(lastFeature); }
		lastLayer = lastFeature = null;

		cancel('info_window');
	}

	function hideFeature() {
		selectedLayer.clearLayers();
		editingLayers.removeLayer(lastLayer);
		geojson.removeLayer(lastLayer);
		lastLayer = lastFeature = null;
		cancel('info_window');
	}

	// Module Exports
	return {
		initMap: initMap,
		submitRegionQuery: submitRegionQuery,
		submitPointQuery: submitPointQuery,
		addProperty: addProperty,
		deleteFeature: deleteFeature,
		editFeature: editFeature,
		cancelAdd: cancelAdd,
		hideFeature: hideFeature
	};
})();
