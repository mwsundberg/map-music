(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const L = require("leaflet");
require("leaflet-tilelayer-colorpicker");
const Music = require("./music-gen");
const WaveformPlaylist = require('waveform-playlist');
//the styles for waveform-playlist are included separately and compiled in a separate step

// Important DOM things
let canvasDOM = document.getElementById("drawingLayer");

// Map toolbar handling
let mapToolbarChildren = document.getElementById("mapToolbar").children;

// Process panning/drawing toggle
document.getElementById("panningMode").oninput = function(e){
    // Set to panning mode by removing click events on the canvas
    console.log("setting pan mode");
    canvasDOM.classList.add("noInteraction");
};

document.getElementById("drawingMode").oninput = function(e){
    console.log("setting drawmode");
    canvasDOM.classList.remove("noInteraction");
};

// Add a place to the saved locations list in display and data
function addPlaceToPresetsDOM(place, index){
    let option = document.createElement("option");
    option.text = place.name;
    option.value = index;
    mapToolbarChildren.locationSelect.add(option);
    savedPlaces[index] = place;
}
savedPlaces = [
    {name: "Grand Canyon", coordinates: [35.81025936, -113.6302593801], zoom: 11},
    {name: "Vancouver Mountains", coordinates: [49.3822072, -123.1363749], zoom: 12},
    {name: "University of Rochester", coordinates: [43.1289624, -77.629125], zoom: 16},
    {name: "Mount Everest", coordinates: [27.9881199, 86.9162203], zoom: 11},
    {name: "Death Valley", coordinates: [36.3885879, -116.89384], zoom: 10},
    {name: "Shenandoah River", coordinates: [38.8879720, -78.3622169], zoom: 12},
    {name: "Appalachian Mountains", coordinates: [37.01330, -81.4879989624], zoom: 11}
];
savedPlaces.forEach(addPlaceToPresetsDOM); // Load in all of the preset options

// Save the current location in the presets list
mapToolbarChildren.saveLocationButton.onclick = function(e){
    // Check if the name is already used in the places array
    let newPlaceName = mapToolbarChildren.saveLocationName.value;
    if(newPlaceName === "" || savedPlaces.reduce((accumulator, place) => {return accumulator || place.name === newPlaceName}, false)){
        console.log("trying to add an already used name, or name not specified.");
    } else {
        // Adding current location to presets list
        addPlaceToPresetsDOM({name: newPlaceName, coordinates: mymap.getCenter(), zoom: mymap.getZoom()}, savedPlaces.length);
        mapToolbarChildren.saveLocationName.value = "";
        mapToolbarChildren.locationSelect.value = savedPlaces.length - 1;
    }
};

// Jump to the preset selected
mapToolbarChildren.locationSelect.oninput = function(e){
    let destination = savedPlaces[mapToolbarChildren.locationSelect.value];
    mymap.setView(destination.coordinates, destination.zoom);
};

// Map settings
const urlTerrain = "https://api.mapbox.com/styles/v1/mwsundberg/ck26wfu0759jk1claf7a3bblm/tiles/{z}/{x}/{y}?access_token={accessToken}";
const urlRGBheight = "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token={accessToken}";
const accessToken = "pk.eyJ1IjoibXdzdW5kYmVyZyIsImEiOiJjazI4Z3lkcHkwb3pzM2RwYm44YW9nM2ZuIn0.EyqGj9GuiUpvoauajxVPgA";

// Map initialization
let mymap = L.map("mapLayer").setView(savedPlaces[0].coordinates, savedPlaces[0].zoom);

// Mapbox map layers
let terrainVisible = L.tileLayer(urlTerrain, {
    attribution: "",
    minZoom: 1,
    maxZoom: 18,
    accessToken: accessToken
}).addTo(mymap);

let elevationData = L.tileLayer.colorPicker(urlRGBheight, {
    attribution: "",
    minZoom: 1,
    maxZoom: 18,
    maxNativeZoom: 14,
    opacity: 0.0,
    accessToken: accessToken
}).addTo(mymap);


//mymap.dragging.disable(); //disable drag for now

// Data for the paths
pathsAsCoordinates = [];
pathsAsPolylines = [];
pathsAsElevations = [];

// Audio config preview canvas
let stagedAudioCanvasDOM = document.getElementById("stagedAudioCanvas");
let stagedAudioCanvasContext = stagedAudioCanvasDOM.getContext("2d");

// Update canvas coordinate system
let mapContainerDOM = document.getElementById("mapWrapper");
let canvasContext = canvasDOM.getContext("2d");
window.onresize = function(e){
    canvasDOM.width = mapContainerDOM.offsetWidth;
    canvasDOM.height = mapContainerDOM.offsetHeight;
    canvasCoordinates = canvasDOM.getBoundingClientRect();

    // Code for later stuff
    stagedAudioCanvasDOM.width = audioControlsContainer.offsetWidth - 20; // 10px padding
    stagedAudioCanvasDOM.height = window.innerHeight / 10; // 10 vh

    // Redraw on resize
    if(pathsAsElevations.length > 0){
        renderElevationHistogram(pathsAsElevations[pathsAsElevations.length-1]);
    }
};
window.onresize(); // Call once to set initial values for coordinate systems

// Drawing code
const draftingLineColor = "#525442";
const setLineColor = "#464738";
let painting = false;
let lineCoordinates = [];
const rawDistanceThreshold = 2;

function getAudioConfigValues() {
    //Grab the values out of each thing that we want
    //Right now we want high note, low note, and duration information
    //High note
    let highNote = parseInt($("#highNote").val());
    let lowNote = parseInt($("#lowNote").val());

    let scalingType = $("#audioLengthScalingMode").val();
    let durationValue = parseFloat($("#audioLength").val());

    let playLivePreview = document.getElementById("playLivePreview").checked;

    let soundName = $("#soundName").val();

    let sampleTo = $("#sampleTo").val();
    let sampleToPredicate = document.getElementById("sampleToPredicate").checked;

    if(scalingType === "totalLength") {
        return {
            highNote: highNote,
            lowNote: lowNote,
            totalPlayTime: durationValue,
            noteDuration: false,
            playLivePreview: playLivePreview,
            soundName: soundName,
            sampleTo: sampleTo,
            sampleToPredicate: sampleToPredicate
        }
    } else if(scalingType === "noteDuration") {
        return {
            highNote: highNote,
            lowNote: lowNote,
            totalPlayTime: false,
            noteDuration: durationValue,
            playLivePreview: playLivePreview,
            soundName: soundName,
            sampleTo: sampleTo,
            sampleToPredicate: sampleToPredicate
        }
    } else {
        console.log("ERROR! Unknown duration interpretation!");
    }
}

document.getElementById("sampleToPredicate").onclick = function(e){
    console.log("toggling resampling.")
    if(this.checked){
        document.getElementById("sampleTo").disabled = false;
    } else {
        document.getElementById("sampleTo").disabled = true;
    }
}

canvasDOM.onmousedown = function(e) {
    painting = true;
    const mouseLocation = L.point(e.clientX - canvasCoordinates.left,
        e.clientY - canvasCoordinates.top);

    lineCoordinates.push(mouseLocation);

    // Start drawing a line
    canvasContext.strokeStyle = draftingLineColor;
    canvasContext.lineJoin = "round";
    canvasContext.lineCap = "round";
    canvasContext.lineWidth = 1;
    canvasContext.beginPath();
    canvasContext.moveTo(mouseLocation.x, mouseLocation.y);
};

canvasDOM.onmousemove = function(e) {
    if(painting) {
        const mouseLocation = L.point(e.clientX - canvasCoordinates.left,
            e.clientY - canvasCoordinates.top);

        // Get the direction of the mouse movement (for use with: https://math.stackexchange.com/a/175906)
        const v = mouseLocation.subtract(lineCoordinates[lineCoordinates.length - 1]);
        const du = v.divideBy(v.distanceTo(L.point(0,0))).multiplyBy(rawDistanceThreshold);

        // If greater than the distance criteria, draw set length lines towards current mouse location until too close
        while(mouseLocation.distanceTo(lineCoordinates[lineCoordinates.length - 1]) >= rawDistanceThreshold){
            // Interpolate a point rawDistanceThreshold units away from the last point (final bit of: https://math.stackexchange.com/a/175906)
            const interpolatedPoint = du.add(lineCoordinates[lineCoordinates.length - 1]);

            // Add the interpolated point to the list
            lineCoordinates.push(interpolatedPoint);

            // Draw the next line segment
            canvasContext.lineTo(interpolatedPoint.x, interpolatedPoint.y);
            canvasContext.stroke();
        }
    }
};

canvasDOM.onmouseup = function(e) {
    // Check if there are enough points to do audio stuff
    if(lineCoordinates.length >= 2) {
        // Convert to a GeoJSON object (Assumes canvas origin and map origin are equivalent)
        const coordinates = lineCoordinates.map((point) => {
            return mymap.containerPointToLatLng(point);
        });

        // Add GeoJSON to the map (and store the path in the polylines list)
        pathsAsPolylines.push(L.polyline(coordinates, {color: setLineColor}).addTo(mymap));

        // Points to elevation data
        const elevations = coordinates.map((point) => {
            const color = elevationData.getColor(point);
            if (color !== null) {
                // Convert the RGB channels to one hex number then scale to mapbox elevation data
                return -10000 + 0.1 * ((color[0] << 16) + (color[1] << 8) + color[2]);
            } else {
                console.log("crap, coordinates at " + point + " aren't color-elevation-readable.");
            }
        });

        // Add elevation data and path to arrays
        pathsAsElevations.push(elevations);
        pathsAsCoordinates.push(coordinates);

        //Get the config values from the page
        let configValues = getAudioConfigValues();
        if(configValues.playLivePreview) {
            Music.playTones(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, configValues.sampleTo, configValues.sampleToPredicate, elevations), configValues);
        }

        renderElevationHistogram(elevations);
    }

    // Reset canvas painting stuff
    canvasContext.closePath();
    canvasContext.clearRect(0, 0, canvasContext.canvas.width, canvasContext.canvas.height); // Clears the canvas
    painting = false;
    lineCoordinates = [];
};

// Render canvas with the height histogram
function renderElevationHistogram(elevations){
    // Plot the elevation map
    let histogramValues = interpolateArray(elevations, Math.floor(stagedAudioCanvasDOM.width));
    const maxHeight =  Math.max( ...histogramValues);
    const minHeight =  Math.min( ...histogramValues);
    stagedAudioCanvasContext.clearRect(0, 0, stagedAudioCanvasDOM.width, stagedAudioCanvasDOM.height);
    histogramValues.forEach((height, index) => {
        let normalizedHeight = (height - minHeight)/(maxHeight - minHeight);
        stagedAudioCanvasContext.fillStyle = "#fff";
        stagedAudioCanvasContext.fillRect(index, stagedAudioCanvasDOM.height * (1 - normalizedHeight), 1, stagedAudioCanvasDOM.height * normalizedHeight);
    });
}

// Audio config options pane submit action
document.getElementById("addStagedAudio").onclick = function(e) {
    let elevations = pathsAsElevations[pathsAsElevations.length - 1];
    let configValues = getAudioConfigValues();
    Music.renderOffline(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, configValues.sampleTo, configValues.sampleToPredicate, elevations), configValues, function (blob) {
        console.log("blob callback, blob:", blob);
        playlist.load([{
            src: blob,
            name: configValues.soundName,
            gain: 0.5
        }]);
    });
};

// Audio config options pane play audio again action
document.getElementById("playStagedAudio").onclick = function(e) {
    let elevations = pathsAsElevations[pathsAsElevations.length - 1];
    let configValues = getAudioConfigValues();
    Music.playTones(normalizeToMidiNotes(configValues.lowNote, configValues.highNote, configValues.sampleTo, configValues.sampleToPredicate, elevations), configValues);
};

function normalizeToMidiNotes(noteMin, noteMax, sampleTo, sampleToPredicate, elevations) {
    //First normalize the elevations to the 100 scale
    const max = Math.max( ...elevations);
    const min = Math.min( ...elevations);

    let normalizedElevations = elevations.map((height) => {
        return ((height - min)/(max - min)) * 100;
    });

    // If the user wants to resample the notes, do so
    if(sampleToPredicate){
        console.log("interpolating");
        normalizedElevations = interpolateArray(normalizedElevations, sampleTo);
    }

    //Next, apply a similar procedure to get midi notes, except this time with rounding bc midi notes are ints
    let midiNotes = [];

    //We don't need to find min and max, they are 0 and 100 by definition
    normalizedElevations.forEach(function(x) {
        let preRoundNote = ((x/100) * (noteMax - noteMin)) + noteMin;
        midiNotes.push(Math.round(preRoundNote));
    });

    return midiNotes;
}

//Setup editor
let playlist = WaveformPlaylist.init({
    samplesPerPixel: 3000,
    mono: true,
    waveHeight: 100,
    container: document.getElementById("loopEditorContainer"),
    state: 'cursor',
    colors: {
        waveOutlineColor: '#3D3D3D',
        timeColor: 'grey',
        fadeColor: 'black',
    },
    controls: {
        show: true,
        width: 200
    },
    zoomLevels: [500, 1000, 3000, 5000]
});

playlist.initExporter();
console.log("added playlist");


/*
PLAYLIST EVENT CONTROL BELOW HERE
 */

let ee = playlist.getEventEmitter();
let $container = $("body");
let startTime = 0;
let endTime = 0;
let audioPos = 0;
let isLooping = false;
let playoutPromises;

function updateSelect(start, end) {
    if (start < end) {
        $('.btn-trim-audio').removeClass('disabled');
    }
    else {
        $('.btn-trim-audio').addClass('disabled');
    }

    startTime = start;
    endTime = end;
}

updateSelect(startTime, endTime);

$container.on("click", ".btn-play", function() {
    ee.emit("play");
});

$container.on("click", ".btn-pause", function() {
    isLooping = false;
    ee.emit("pause");
});

$container.on("click", ".btn-stop", function() {
    isLooping = false;
    ee.emit("stop");
});

$container.on("click", ".btn-clear", function() {
    isLooping = false;
    ee.emit("clear");
});

document.getElementById("btn-cursor").onclick = function(e) {
    ee.emit("statechange", "cursor");
};

document.getElementById("btn-select").onclick = function(e) {
    ee.emit("statechange", "select");
};

document.getElementById("btn-shift").onclick = function(e) {
    ee.emit("statechange", "shift");
};

$container.on("click", ".btn-trim-audio", function() {
    ee.emit("trim");
});

$container.on("click", ".btn-download", function () {
    ee.emit('startaudiorendering', 'wav');
});

ee.on('audiorenderingfinished', function (type, data) {
    if(type == 'wav'){
        // Make a download link and click it, then make it all go away
        let anchor = document.createElement('a');
        anchor.style = 'display: none';
        anchor.href = window.URL.createObjectURL(data);
        document.body.appendChild(anchor);
        anchor.download = 'audio.wav';
        anchor.click();
        window.URL.revokeObjectURL(anchor.href);
        anchor.remove();
    }
});

// Linear interpolation function for remapping elevation data (source: https://stackoverflow.com/a/26941169/3196151)
function interpolateArray(data, newLength) {
    const indexScalar = (data.length - 1) / (newLength - 1);
    let resultData = [];

    // Set the first value to be the same
    resultData[0] = data[0];

    // For each new index
    for (let i = 1; i < newLength - 1; i++) {
        // Figure out how far through the original data it is (and which two datapoints are on either side of it)
        let howFar = i * indexScalar;
        let beforeIndex = Math.floor(howFar);
        let afterIndex = Math.ceil(howFar);

        // Save the value interpolated that far in ()
        resultData[i] = ((before, after, atPoint) => {return before + (after - before) * atPoint;})(data[beforeIndex], data[afterIndex], howFar - beforeIndex);
    }

    // Set the last value to be the same
    resultData[newLength - 1] = data[data.length - 1];

    return resultData;
}

//Event listeners for keyboard controls
document.addEventListener("keydown", function(e) {
    if(document.activeElement !== document.getElementsByTagName("body")[0]) {
        return; //no keyboard shortcuts while typing or having anything selected, just when the body is active
    }
    const keyName = e.key;
    switch(keyName){
        case " ":
            // Spacebar: toggle play pause
            if(playlist.isPlaying()) {
                isLooping = false;
                ee.emit("pause");
            } else {
                ee.emit("play");
            }
            break;
        case "p":
            // P: map panning mode
            // Set to panning mode by removing click events on the canvas
            canvasDOM.classList.add("noInteraction");
            document.getElementById("panningMode").checked = true;
            break;
        case "d":
            // D: map drawing mode
            canvasDOM.classList.remove("noInteraction");
            document.getElementById("drawingMode").checked = true;
            break;
        case "s":
            // S: stop playlist audio
            isLooping = false;
            ee.emit("stop");
            break;
        case "x":
            // X: clear playlist tracks
            isLooping = false;
            ee.emit("clear");
            break;
        case "c":
            // C: cursor playlist tool
            ee.emit("statechange", "cursor");
            document.getElementById("btn-cursor").checked = true;
            break;
        case "l":
            // L: select playlist tool
            ee.emit("statechange", "select");
            document.getElementById("btn-select").checked = true;
            break;
        case "f":
            // F: shift playlist tool
            ee.emit("statechange", "shift");
            document.getElementById("btn-shift").checked = true;
            break;
        case "t":
            // T: trip selection in playlist
            ee.emit("trim");
            break;
    }
});


/*
PROJECT FILE SAVE/LOAD
 */

//Utility
function ab2str(buf) {
    let arr = new Uint16Array(buf);
    let str = "";
    for(let i=0; i<arr.length; i++) {
        str += String.fromCharCode(arr[i]);
    }
    return str;
}
function str2ab(str) {
    let buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
    let bufView = new Uint16Array(buf);
    for (let i=0, strLen=str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}


$("#projSave").on("click", function() {
    //Assemble the components for the file
    //paths object

    let plGJSON = pathsAsPolylines.map(x => x.toGeoJSON(8));
    const paths = {
        elevations: pathsAsElevations,
        coordinates: pathsAsCoordinates,
        polylines: plGJSON
    };


    const mapCenter = mymap.getCenter();
    const mapZoom = mymap.getZoom();


    const rawTracks = playlist.getInfo();
    console.log(rawTracks);
    let tracks = [];
    let trackPromises = [];
    rawTracks.forEach(function(x) {
        //Need to convert the blob to base64
        let reader = new window.FileReader();
        trackPromises.push(new Promise(function(resolve, reject) {
            reader.readAsDataURL(x.src);
            reader.onloadend = function () {
                let base64data = reader.result;

                let trackObj = {
                    blob64: base64data,
                    blobSize: x.src.size,
                    blobType: x.src.type,
                    name: x.name,
                    start: x.start,
                    end: x.end,
                    cuein: x.cuein,
                    cueout: x.cueout
                };
                tracks.push(trackObj);
                resolve();
            }
        }));
    });

    Promise.all(trackPromises).then(function() {
        console.log("ALL TRACKS DONE!");
        console.log(tracks);
        //Final object
        let save = {
            filetype: "mapmusic-save",
            paths: paths,
            tracks: tracks,
            mapCenter: mapCenter,
            mapZoom: mapZoom,
            savedPlaces: savedPlaces
        };

        //Write out
        const data = JSON.stringify(save);
        const ab = str2ab(data);
        const fileBlob = new window.Blob([new DataView(ab)], {
            type: "application/json"
        });
        let anchor = document.createElement('a');
        document.body.appendChild(anchor);
        anchor.style = 'display: none';
        let url = window.URL.createObjectURL(fileBlob);
        anchor.href = url;
        anchor.download = 'proj.json';
        anchor.click();
        window.URL.revokeObjectURL(url);
    });
});

$("#projLoad").on("click", function() {
    //Show the choose file button
    document.getElementById("chooseFileContainer").style.display = "inline"
});

document.getElementById("filePicker").addEventListener("change", handleFileSelect, false);
function handleFileSelect(e) {
    let files = e.target.files;
    //Get files[0]
    let projFile = files[0];
    console.log(projFile);
    let reader = new FileReader();
    reader.readAsArrayBuffer(projFile);
    reader.onloadend = function() {
        let abdata = reader.result;
        //console.log(abdata);
        let strData = ab2str(abdata);
        //console.log(strData.substring(0,101));
        try {
            let projData = JSON.parse(strData);
            if(projData["filetype"] !== "mapmusic-save") {
                throw new Error("wrong filetype");
            }
            //Unpack the project data into its various components
            //First set up the easy stuff
            let mapCenter = projData.mapCenter;
            let mapZoom = projData.mapZoom;
            let fileSavedPlaces = projData.savedPlaces;

            //Extract the polylines and convert back to leaflet obj, and the other path info
            let leafletPolylines = projData.paths.polylines.map(x => L.geoJSON(x));
            let filePathsAsElevations = projData.paths.elevations;
            let filePathsAsCoordinates = projData.paths.coordinates;

            //Extract the tracks
            let trackData = [];
            projData.tracks.forEach(function(trackObj) {
                //Create a new blob from the base64 representation
                //cut off the preamble/header thing
                const byteCharacters = atob(trackObj.blob64.substring(22));
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const trackBlob = new Blob([byteArray], {
                    type: trackObj.blobType
                });

                trackData.push({
                    src: trackBlob,
                    start: trackObj.start,
                    end: trackObj.end,
                    cuein: trackObj.cuein,
                    cueout: trackObj.cueout,
                    name: trackObj.name
                })
            });

            //Now we have everything back how it should be. Load it all back in
            //Clear the playlist first.
            playlist.clear();
            //Load tracks into playlist
            playlist.load(trackData);
            //Load paths in
            this.pathsAsElevations = filePathsAsElevations;
            this.pathsAsCoordinates = filePathsAsCoordinates;
            //Clear the leaflet map
            mymap.eachLayer(function (layer) {
                if(layer === elevationData || layer === terrainVisible) {
                    return;
                }
                mymap.removeLayer(layer);
            });
            //And add the polylines back
            leafletPolylines.forEach(function(p) {
                p.addTo(mymap);
            });
            //Load the saved places in
            //Clear the dropdown before we add everything back
            mapToolbarChildren.locationSelect.innerHTML = "";
            this.savedPlaces = fileSavedPlaces;
            this.savedPlaces.forEach(addPlaceToPresetsDOM);
            //Set the map center and zoom
            mymap.center = mapCenter;
            mymap.zoom = mapZoom;


        } catch (e) {
            console.log("NOT A MAP MUSIC PROJECT SAVE!");
            console.log(e);

        }

        //Hide the choose file button now that we are done
        document.getElementById("chooseFileContainer").style.display = "none";
    }
}
},{"./music-gen":2,"leaflet":32,"leaflet-tilelayer-colorpicker":31,"waveform-playlist":75}],2:[function(require,module,exports){
const Tone = require("tone");
//const toWav = require("audiobuffer-to-wav");
const toWav = require("./wav-export").wavFromBuffer;
//NOTE: Tone.js should be included in the HTML before this file
function midi(note) {
    return new Tone.Frequency(note, "midi");
}

function playTones(midiNotes, config) {
    let totalPlayTime;
    if(!config.totalPlayTime) {
        //The duration value is to be interpreted as a note duration
        //We can get the total play time by multiplying by the number of notes
        totalPlayTime = config.noteDuration * midiNotes.length;
    } else {
        totalPlayTime = config.totalPlayTime;
    }
    //Initialization - set up synth and clear transport timeline
    Tone.Transport.stop();
    let synth = new Tone.Synth().toMaster();

    Tone.Transport._timeline.forEach(function(x) {
        Tone.Transport._timeline.remove(x);
    });

    //Convert notes into actual note objects
    let noteDurationSec = totalPlayTime / midiNotes.length;
    let noteSequence = [];
    for(let i=0; i<midiNotes.length; i++) {
        noteSequence.push(midi(midiNotes[i]));
    }

    //Setup play sequence
    let seq = new Tone.Sequence(function(time, note) {
        synth.triggerAttackRelease(note, noteDurationSec, time);
    }, noteSequence, noteDurationSec).start(0);
    seq.loop = false;

    //And play
    Tone.Transport.start();
    //Tone.Transport.clear(seq)
}

//Callback will be called with a blob of the wav of the rendered audio
function renderOffline(midiNotes, config, callback) {
    let totalPlayTime;
    if(!config.totalPlayTime) {
        //The duration value is to be interpreted as a note duration
        //We can get the total play time by multiplying by the number of notes
        totalPlayTime = config.noteDuration * midiNotes.length;
    } else {
        totalPlayTime = config.totalPlayTime;
    }
    Tone.Offline(function() {
        playTones(midiNotes, config);
    }, totalPlayTime).then(function(buffer) {
        //Do something with output buffer
        let wavBlob = toWav(buffer);
        /*let blob = new window.Blob([ new DataView(wav) ], {
            type: 'audio/wav'
        });*/

        /*let anchor = document.createElement('a');
        document.body.appendChild(anchor);
        anchor.style = 'display: none';
        let url = window.URL.createObjectURL(wavBlob);
        anchor.href = url;
        anchor.download = 'audio.wav';
        anchor.click();
        window.URL.revokeObjectURL(url);*/

        callback(wavBlob);
    })
}

module.exports = {
    playTones: playTones,
    renderOffline: renderOffline
};

},{"./wav-export":4,"tone":3}],3:[function(require,module,exports){
!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.Tone=e():t.Tone=e()}("undefined"!=typeof self?self:this,function(){return function(t){var e={};function i(s){if(e[s])return e[s].exports;var n=e[s]={i:s,l:!1,exports:{}};return t[s].call(n.exports,n,n.exports,i),n.l=!0,n.exports}return i.m=t,i.c=e,i.d=function(t,e,s){i.o(t,e)||Object.defineProperty(t,e,{configurable:!1,enumerable:!0,get:s})},i.r=function(t){Object.defineProperty(t,"__esModule",{value:!0})},i.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return i.d(e,"a",e),e},i.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},i.p="",i(i.s=148)}([function(t,e,i){"use strict";i.r(e),function(t){var s=i(93),n=function(){if(!(this instanceof n))throw new Error("constructor needs to be called with the 'new' keyword")};
/**
 *  Tone.js
 *  @author Yotam Mann
 *  @license http://opensource.org/licenses/MIT MIT License
 *  @copyright 2014-2019 Yotam Mann
 */n.prototype.toString=function(){for(var t in n){var e=t[0].match(/^[A-Z]$/),i=n[t]===this.constructor;if(n.isFunction(n[t])&&e&&i)return t}return"Tone"},n.prototype.dispose=function(){return this},n.prototype.set=function(t,e){if(n.isString(t)){var i={};i[t]=e,t=i}t:for(var s in t){e=t[s];var o=this;if(-1!==s.indexOf(".")){for(var a=s.split("."),r=0;r<a.length-1;r++)if((o=o[a[r]])instanceof n){a.splice(0,r+1);var l=a.join(".");o.set(l,e);continue t}s=a[a.length-1]}var u=o[s];n.isUndef(u)||(n.Signal&&u instanceof n.Signal||n.Param&&u instanceof n.Param?u.value!==e&&(u.value=e):u instanceof AudioParam?u.value!==e&&(u.value=e):n.TimeBase&&u instanceof n.TimeBase?o[s]=e:u instanceof n?u.set(e):u!==e&&(o[s]=e))}return this},n.prototype.get=function(t){n.isUndef(t)?t=this._collectDefaults(this.constructor):n.isString(t)&&(t=[t]);for(var e={},i=0;i<t.length;i++){var s=t[i],o=this,a=e;if(-1!==s.indexOf(".")){for(var r=s.split("."),l=0;l<r.length-1;l++){var u=r[l];a[u]=a[u]||{},a=a[u],o=o[u]}s=r[r.length-1]}var d=o[s];n.isObject(t[s])?a[s]=d.get():n.Signal&&d instanceof n.Signal?a[s]=d.value:n.Param&&d instanceof n.Param?a[s]=d.value:d instanceof AudioParam?a[s]=d.value:d instanceof n?a[s]=d.get():!n.isFunction(d)&&n.isDefined(d)&&(a[s]=d)}return e},n.prototype._collectDefaults=function(t){var e=[];if(n.isDefined(t.defaults)&&(e=Object.keys(t.defaults)),n.isDefined(t._super))for(var i=this._collectDefaults(t._super),s=0;s<i.length;s++)-1===e.indexOf(i[s])&&e.push(i[s]);return e},n.defaults=function(t,e,i){var s={};if(1===t.length&&n.isObject(t[0]))s=t[0];else for(var o=0;o<e.length;o++)s[e[o]]=t[o];return n.isDefined(i.defaults)?n.defaultArg(s,i.defaults):n.isObject(i)?n.defaultArg(s,i):s},n.defaultArg=function(t,e){if(n.isObject(t)&&n.isObject(e)){var i={};for(var s in t)i[s]=n.defaultArg(e[s],t[s]);for(var o in e)i[o]=n.defaultArg(t[o],e[o]);return i}return n.isUndef(t)?e:t},n.prototype.log=function(){if(this.debug||this.toString()===n.global.TONE_DEBUG_CLASS){var t=Array.from(arguments);t.unshift(this.toString()+":"),console.log.apply(void 0,t)}},n.prototype.assert=function(t,e){if(!t)throw new Error(e)},n.connectSeries=function(){for(var t=arguments[0],e=1;e<arguments.length;e++){var i=arguments[e];n.connect(t,i),t=i}return n},n.connect=function(t,e,i,s){for(;n.isDefined(e.input);)n.isArray(e.input)?(s=n.defaultArg(s,0),e=e.input[s],s=0):e.input&&(e=e.input);return e instanceof AudioParam?t.connect(e,i):e instanceof AudioNode&&t.connect(e,i,s),n},n.disconnect=function(t,e,i,s){if(e){for(var o=!1;!o;)n.isArray(e.input)?(n.isDefined(s)?n.disconnect(t,e.input[s],i):e.input.forEach(function(e){try{n.disconnect(t,e,i)}catch(t){}}),o=!0):e.input?e=e.input:o=!0;e instanceof AudioParam?t.disconnect(e,i):e instanceof AudioNode&&t.disconnect(e,i,s)}else t.disconnect();return n},n.isUndef=function(t){return void 0===t},n.isDefined=function(t){return!n.isUndef(t)},n.isFunction=function(t){return"function"==typeof t},n.isNumber=function(t){return"number"==typeof t},n.isObject=function(t){return"[object Object]"===Object.prototype.toString.call(t)&&t.constructor===Object},n.isBoolean=function(t){return"boolean"==typeof t},n.isArray=function(t){return Array.isArray(t)},n.isString=function(t){return"string"==typeof t},n.isNote=function(t){return n.isString(t)&&/^([a-g]{1}(?:b|#|x|bb)?)(-?[0-9]+)/i.test(t)},n.noOp=function(){},n.prototype._readOnly=function(t){if(Array.isArray(t))for(var e=0;e<t.length;e++)this._readOnly(t[e]);else Object.defineProperty(this,t,{writable:!1,enumerable:!0})},n.prototype._writable=function(t){if(Array.isArray(t))for(var e=0;e<t.length;e++)this._writable(t[e]);else Object.defineProperty(this,t,{writable:!0})},n.State={Started:"started",Stopped:"stopped",Paused:"paused"},n.global=n.isUndef(t)?window:t,n.equalPowerScale=function(t){var e=.5*Math.PI;return Math.sin(t*e)},n.dbToGain=function(t){return Math.pow(10,t/20)},n.gainToDb=function(t){return Math.log(t)/Math.LN10*20},n.intervalToFrequencyRatio=function(t){return Math.pow(2,t/12)},n.prototype.now=function(){return n.context.now()},n.now=function(){return n.context.now()},n.prototype.immediate=function(){return n.context.currentTime},n.immediate=function(){return n.context.currentTime},n.extend=function(t,e){function i(){}n.isUndef(e)&&(e=n),i.prototype=e.prototype,t.prototype=new i,t.prototype.constructor=t,t._super=e},n._audioContext=null,n.start=function(){return n.context.resume()},Object.defineProperty(n,"context",{get:function(){return n._audioContext},set:function(t){t.isContext?n._audioContext=t:n._audioContext=new n.Context(t),n.Context.emit("init",n._audioContext)}}),Object.defineProperty(n.prototype,"context",{get:function(){return n.context}}),n.setContext=function(t){n.context=t},Object.defineProperty(n.prototype,"blockTime",{get:function(){return 128/this.context.sampleRate}}),Object.defineProperty(n.prototype,"sampleTime",{get:function(){return 1/this.context.sampleRate}}),Object.defineProperty(n,"supported",{get:function(){var t=n.global.hasOwnProperty("AudioContext")||n.global.hasOwnProperty("webkitAudioContext"),e=n.global.hasOwnProperty("Promise");return t&&e}}),Object.defineProperty(n,"initialized",{get:function(){return Boolean(n.context)}}),n.getContext=function(t){if(n.initialized)t(n.context);else{var e=function(){t(n.context),n.Context.off("init",e)};n.Context.on("init",e)}return n},n.version=s.a,e.default=n}.call(this,i(147))},function(t,e,i){"use strict";i.r(e);var s=i(0);i(20);if(s.default.supported){var n=new OfflineAudioContext(2,1,44100),o=n.createGain(),a=n.createGain();if(o.connect(a)!==a){var r=AudioNode.prototype.connect;AudioNode.prototype.connect=function(){return r.apply(this,arguments),arguments[0]}}}s.default.AudioNode=function(){s.default.call(this);var t=s.default.defaults(arguments,["context"],{context:s.default.context});this._context=t.context},s.default.extend(s.default.AudioNode),Object.defineProperty(s.default.AudioNode.prototype,"context",{get:function(){return this._context}}),s.default.AudioNode.prototype.createInsOuts=function(t,e){1===t?this.input=this.context.createGain():t>1&&(this.input=new Array(t)),1===e?this.output=this.context.createGain():e>1&&(this.output=new Array(e))},Object.defineProperty(s.default.AudioNode.prototype,"channelCount",{get:function(){return this.output.channelCount},set:function(t){return this.output.channelCount=t}}),Object.defineProperty(s.default.AudioNode.prototype,"channelCountMode",{get:function(){return this.output.channelCountMode},set:function(t){return this.output.channelCountMode=t}}),Object.defineProperty(s.default.AudioNode.prototype,"channelInterpretation",{get:function(){return this.output.channelInterpretation},set:function(t){return this.output.channelInterpretation=t}}),Object.defineProperty(s.default.AudioNode.prototype,"numberOfInputs",{get:function(){return this.input?s.default.isArray(this.input)?this.input.length:1:0}}),Object.defineProperty(s.default.AudioNode.prototype,"numberOfOutputs",{get:function(){return this.output?s.default.isArray(this.output)?this.output.length:1:0}}),s.default.AudioNode.prototype.connect=function(t,e,i){return s.default.isArray(this.output)?(e=s.default.defaultArg(e,0),this.output[e].connect(t,0,i)):s.default.connect(this.output,t,e,i),this},s.default.AudioNode.prototype.disconnect=function(t,e,i){return s.default.isArray(this.output)?(e=s.default.defaultArg(e,0),this.output[e].disconnect(t,0,i)):s.default.disconnect(this.output,t,e,i),this},s.default.AudioNode.prototype.chain=function(){var t=Array.from(arguments);return t.unshift(this),s.default.connectSeries.apply(void 0,t),this},s.default.AudioNode.prototype.fan=function(){for(var t=0;t<arguments.length;t++)this.connect(arguments[t]);return this},s.default.AudioNode.prototype.dispose=function(){return s.default.isDefined(this.input)&&(this.input instanceof AudioNode&&this.input.disconnect(),this.input=null),s.default.isDefined(this.output)&&(this.output instanceof AudioNode&&this.output.disconnect(),this.output=null),this._context=null,this};e.default=s.default.AudioNode},function(t,e,i){"use strict";i.r(e);var s=i(0);i(4),i(14),i(30),i(44),i(20),i(3);if(s.default.supported&&!s.default.global.AudioContext.prototype.createConstantSource){var n=function(t){this.context=t;for(var e=t.createBuffer(1,128,t.sampleRate),i=e.getChannelData(0),s=0;s<i.length;s++)i[s]=1;this._bufferSource=t.createBufferSource(),this._bufferSource.channelCount=1,this._bufferSource.channelCountMode="explicit",this._bufferSource.buffer=e,this._bufferSource.loop=!0;var n=this._output=t.createGain();this.offset=n.gain,this._bufferSource.connect(n)};n.prototype.start=function(t){return this._bufferSource.start(t),this},n.prototype.stop=function(t){return this._bufferSource.stop(t),this},n.prototype.connect=function(){return this._output.connect.apply(this._output,arguments),this},n.prototype.disconnect=function(){return this._output.disconnect.apply(this._output,arguments),this},AudioContext.prototype.createConstantSource=function(){return new n(this)},s.default.Context.prototype.createConstantSource=function(){return new n(this)}}s.default.Signal=function(){var t=s.default.defaults(arguments,["value","units"],s.default.Signal);s.default.Param.call(this,t),this._constantSource=this.context.createConstantSource(),this._constantSource.start(0),this._param=this._constantSource.offset,this.value=t.value,this.output=this._constantSource,this.input=this._param=this.output.offset},s.default.extend(s.default.Signal,s.default.Param),s.default.Signal.defaults={value:0,units:s.default.Type.Default,convert:!0},s.default.Signal.prototype.connect=s.default.SignalBase.prototype.connect,s.default.Signal.prototype.disconnect=s.default.SignalBase.prototype.disconnect,s.default.Signal.prototype.getValueAtTime=function(t){return this._param.getValueAtTime?this._param.getValueAtTime(t):s.default.Param.prototype.getValueAtTime.call(this,t)},s.default.Signal.prototype.dispose=function(){return s.default.Param.prototype.dispose.call(this),this._constantSource.stop(),this._constantSource.disconnect(),this._constantSource=null,this};e.default=s.default.Signal},function(t,e,i){"use strict";i.r(e);var s=i(0);i(14),i(4),i(1);s.default.Gain=function(){var t=s.default.defaults(arguments,["gain","units"],s.default.Gain);s.default.AudioNode.call(this,t),this.input=this.output=this._gainNode=this.context.createGain(),this.gain=new s.default.Param({param:this._gainNode.gain,units:t.units,value:t.gain,convert:t.convert}),this._readOnly("gain")},s.default.extend(s.default.Gain,s.default.AudioNode),s.default.Gain.defaults={gain:1,convert:!0},s.default.Gain.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._gainNode.disconnect(),this._gainNode=null,this._writable("gain"),this.gain.dispose(),this.gain=null},e.default=s.default.Gain},function(t,e,i){"use strict";i.r(e);var s=i(0);i(63),i(46),i(45),i(20);s.default.Type={Default:"number",Time:"time",Frequency:"frequency",TransportTime:"transportTime",Ticks:"ticks",NormalRange:"normalRange",AudioRange:"audioRange",Decibels:"db",Interval:"interval",BPM:"bpm",Positive:"positive",Gain:"gain",Cents:"cents",Degrees:"degrees",MIDI:"midi",BarsBeatsSixteenths:"barsBeatsSixteenths",Samples:"samples",Hertz:"hertz",Note:"note",Milliseconds:"milliseconds",Seconds:"seconds",Notation:"notation"},s.default.prototype.toSeconds=function(t){return s.default.isNumber(t)?t:s.default.isUndef(t)?this.now():s.default.isString(t)||s.default.isObject(t)?new s.default.Time(t).toSeconds():t instanceof s.default.TimeBase?t.toSeconds():void 0},s.default.prototype.toFrequency=function(t){return s.default.isNumber(t)?t:s.default.isString(t)||s.default.isUndef(t)||s.default.isObject(t)?new s.default.Frequency(t).valueOf():t instanceof s.default.TimeBase?t.toFrequency():void 0},s.default.prototype.toTicks=function(t){return s.default.isNumber(t)||s.default.isString(t)||s.default.isObject(t)?new s.default.TransportTime(t).toTicks():s.default.isUndef(t)?s.default.Transport.ticks:t instanceof s.default.TimeBase?t.toTicks():void 0},e.default=s.default},function(t,e,i){"use strict";i.r(e);var s=i(0);i(14),i(3),i(30);s.default.Multiply=function(t){s.default.Signal.call(this),this.createInsOuts(2,0),this._mult=this.input[0]=this.output=new s.default.Gain,this._param=this.input[1]=this.output.gain,this.value=s.default.defaultArg(t,0)},s.default.extend(s.default.Multiply,s.default.Signal),s.default.Multiply.prototype.dispose=function(){return s.default.Signal.prototype.dispose.call(this),this._mult.dispose(),this._mult=null,this._param=null,this},e.default=s.default.Multiply},function(t,e,i){"use strict";i.r(e);var s=i(0);i(16),i(27),i(40),i(4),i(34),i(2),i(1);s.default.Source=function(t){t=s.default.defaultArg(t,s.default.Source.defaults),s.default.AudioNode.call(this),this._volume=this.output=new s.default.Volume(t.volume),this.volume=this._volume.volume,this._readOnly("volume"),this._state=new s.default.TimelineState(s.default.State.Stopped),this._state.memory=100,this._synced=!1,this._scheduled=[],this._volume.output.output.channelCount=2,this._volume.output.output.channelCountMode="explicit",this.mute=t.mute},s.default.extend(s.default.Source,s.default.AudioNode),s.default.Source.defaults={volume:0,mute:!1},Object.defineProperty(s.default.Source.prototype,"state",{get:function(){return this._synced?s.default.Transport.state===s.default.State.Started?this._state.getValueAtTime(s.default.Transport.seconds):s.default.State.Stopped:this._state.getValueAtTime(this.now())}}),Object.defineProperty(s.default.Source.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t}}),s.default.Source.prototype._start=s.default.noOp,s.default.Source.prototype.restart=s.default.noOp,s.default.Source.prototype._stop=s.default.noOp,s.default.Source.prototype.start=function(t,e,i){if(s.default.isUndef(t)&&this._synced?t=s.default.Transport.seconds:(t=this.toSeconds(t),t=Math.max(t,this.context.currentTime)),this._state.getValueAtTime(t)===s.default.State.Started)this._state.cancel(t),this._state.setStateAtTime(s.default.State.Started,t),this.restart(t,e,i);else if(this._state.setStateAtTime(s.default.State.Started,t),this._synced){var n=this._state.get(t);n.offset=s.default.defaultArg(e,0),n.duration=i;var o=s.default.Transport.schedule(function(t){this._start(t,e,i)}.bind(this),t);this._scheduled.push(o),s.default.Transport.state===s.default.State.Started&&this._syncedStart(this.now(),s.default.Transport.seconds)}else this._start.apply(this,arguments);return this},s.default.Source.prototype.stop=function(t){if(s.default.isUndef(t)&&this._synced?t=s.default.Transport.seconds:(t=this.toSeconds(t),t=Math.max(t,this.context.currentTime)),this._synced){var e=s.default.Transport.schedule(this._stop.bind(this),t);this._scheduled.push(e)}else this._stop.apply(this,arguments);return this._state.cancel(t),this._state.setStateAtTime(s.default.State.Stopped,t),this},s.default.Source.prototype.sync=function(){return this._synced=!0,this._syncedStart=function(t,e){if(e>0){var i=this._state.get(e);if(i&&i.state===s.default.State.Started&&i.time!==e){var n,o=e-this.toSeconds(i.time);i.duration&&(n=this.toSeconds(i.duration)-o),this._start(t,this.toSeconds(i.offset)+o,n)}}}.bind(this),this._syncedStop=function(t){var e=s.default.Transport.getSecondsAtTime(Math.max(t-this.sampleTime,0));this._state.getValueAtTime(e)===s.default.State.Started&&this._stop(t)}.bind(this),s.default.Transport.on("start loopStart",this._syncedStart),s.default.Transport.on("stop pause loopEnd",this._syncedStop),this},s.default.Source.prototype.unsync=function(){this._synced&&(s.default.Transport.off("stop pause loopEnd",this._syncedStop),s.default.Transport.off("start loopStart",this._syncedStart)),this._synced=!1;for(var t=0;t<this._scheduled.length;t++){var e=this._scheduled[t];s.default.Transport.clear(e)}return this._scheduled=[],this._state.cancel(0),this},s.default.Source.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this.unsync(),this._scheduled=null,this._writable("volume"),this._volume.dispose(),this._volume=null,this.volume=null,this._state.dispose(),this._state=null},e.default=s.default.Source},function(t,e,i){"use strict";i.r(e);var s=i(0);i(30),i(44);if(s.default.supported&&!s.default.global.AudioContext.prototype._native_createWaveShaper){var n=navigator.userAgent.toLowerCase();if(n.includes("safari")&&!n.includes("chrome")){var o=function(t){for(var e in this._internalNode=this.input=this.output=t._native_createWaveShaper(),this._curve=null,this._internalNode)this._defineProperty(this._internalNode,e)};Object.defineProperty(o.prototype,"curve",{get:function(){return this._curve},set:function(t){this._curve=t;var e=new Float32Array(t.length+1);e.set(t,1),e[0]=t[0],this._internalNode.curve=e}}),o.prototype._defineProperty=function(t,e){s.default.isUndef(this[e])&&Object.defineProperty(this,e,{get:function(){return"function"==typeof t[e]?t[e].bind(t):t[e]},set:function(i){t[e]=i}})},s.default.global.AudioContext.prototype._native_createWaveShaper=s.default.global.AudioContext.prototype.createWaveShaper,s.default.global.AudioContext.prototype.createWaveShaper=function(){return new o(this)}}}s.default.WaveShaper=function(t,e){s.default.SignalBase.call(this),this._shaper=this.input=this.output=this.context.createWaveShaper(),this._curve=null,Array.isArray(t)?this.curve=t:isFinite(t)||s.default.isUndef(t)?this._curve=new Float32Array(s.default.defaultArg(t,1024)):s.default.isFunction(t)&&(this._curve=new Float32Array(s.default.defaultArg(e,1024)),this.setMap(t))},s.default.extend(s.default.WaveShaper,s.default.SignalBase),s.default.WaveShaper.prototype.setMap=function(t){for(var e=new Array(this._curve.length),i=0,s=this._curve.length;i<s;i++){var n=i/(s-1)*2-1;e[i]=t(n,i)}return this.curve=e,this},Object.defineProperty(s.default.WaveShaper.prototype,"curve",{get:function(){return this._shaper.curve},set:function(t){this._curve=new Float32Array(t),this._shaper.curve=this._curve}}),Object.defineProperty(s.default.WaveShaper.prototype,"oversample",{get:function(){return this._shaper.oversample},set:function(t){if(!["none","2x","4x"].includes(t))throw new RangeError("Tone.WaveShaper: oversampling must be either 'none', '2x', or '4x'");this._shaper.oversample=t}}),s.default.WaveShaper.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._shaper.disconnect(),this._shaper=null,this._curve=null,this};e.default=s.default.WaveShaper},function(t,e,i){"use strict";i.r(e);var s=i(0);i(23),i(1);s.default.Effect=function(){var t=s.default.defaults(arguments,["wet"],s.default.Effect);s.default.AudioNode.call(this),this.createInsOuts(1,1),this._dryWet=new s.default.CrossFade(t.wet),this.wet=this._dryWet.fade,this.effectSend=new s.default.Gain,this.effectReturn=new s.default.Gain,s.default.connect(this.input,this._dryWet.a),s.default.connect(this.input,this.effectSend),this.effectReturn.connect(this._dryWet.b),this._dryWet.connect(this.output),this._readOnly(["wet"])},s.default.extend(s.default.Effect,s.default.AudioNode),s.default.Effect.defaults={wet:1},s.default.Effect.prototype.connectEffect=function(t){return this.effectSend.chain(t,this.effectReturn),this},s.default.Effect.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._dryWet.dispose(),this._dryWet=null,this.effectSend.dispose(),this.effectSend=null,this.effectReturn.dispose(),this.effectReturn=null,this._writable(["wet"]),this.wet=null,this},e.default=s.default.Effect},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(1);s.default.Filter=function(){var t=s.default.defaults(arguments,["frequency","type","rolloff"],s.default.Filter);s.default.AudioNode.call(this),this.createInsOuts(1,1),this._filters=[],this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=new s.default.Signal(0,s.default.Type.Cents),this.gain=new s.default.Signal({value:t.gain,convert:!0,type:s.default.Type.Decibels}),this.Q=new s.default.Signal(t.Q),this._type=t.type,this._rolloff=t.rolloff,this.rolloff=t.rolloff,this._readOnly(["detune","frequency","gain","Q"])},s.default.extend(s.default.Filter,s.default.AudioNode),s.default.Filter.defaults={type:"lowpass",frequency:350,rolloff:-12,Q:1,gain:0},Object.defineProperty(s.default.Filter.prototype,"type",{get:function(){return this._type},set:function(t){if(-1===["lowpass","highpass","bandpass","lowshelf","highshelf","notch","allpass","peaking"].indexOf(t))throw new TypeError("Tone.Filter: invalid type "+t);this._type=t;for(var e=0;e<this._filters.length;e++)this._filters[e].type=t}}),Object.defineProperty(s.default.Filter.prototype,"rolloff",{get:function(){return this._rolloff},set:function(t){t=parseInt(t,10);var e=[-12,-24,-48,-96].indexOf(t);if(-1===e)throw new RangeError("Tone.Filter: rolloff can only be -12, -24, -48 or -96");e+=1,this._rolloff=t,this.input.disconnect();for(var i=0;i<this._filters.length;i++)this._filters[i].disconnect(),this._filters[i]=null;this._filters=new Array(e);for(var n=0;n<e;n++){var o=this.context.createBiquadFilter();o.type=this._type,this.frequency.connect(o.frequency),this.detune.connect(o.detune),this.Q.connect(o.Q),this.gain.connect(o.gain),this._filters[n]=o}var a=[this.input].concat(this._filters).concat([this.output]);s.default.connectSeries.apply(s.default,a)}}),s.default.Filter.prototype.getFrequencyResponse=function(t){t=s.default.defaultArg(t,128);for(var e=new Float32Array(t).map(function(){return 1}),i=new Float32Array(t),n=0;n<t;n++){var o=19980*Math.pow(n/t,2)+20;i[n]=o}var a=new Float32Array(t),r=new Float32Array(t);return this._filters.forEach(function(){var t=this.context.createBiquadFilter();t.type=this._type,t.Q.value=this.Q.value,t.frequency.value=this.frequency.value,t.gain.value=this.gain.value,t.getFrequencyResponse(i,a,r),a.forEach(function(t,i){e[i]*=t})}.bind(this)),e},s.default.Filter.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this);for(var t=0;t<this._filters.length;t++)this._filters[t].disconnect(),this._filters[t]=null;return this._filters=null,this._writable(["detune","frequency","gain","Q"]),this.frequency.dispose(),this.Q.dispose(),this.frequency=null,this.Q=null,this.detune.dispose(),this.detune=null,this.gain.dispose(),this.gain=null,this},e.default=s.default.Filter},function(t,e,i){"use strict";i.r(e);var s=i(0);i(1);s.default.Merge=function(t){t=s.default.defaultArg(t,2),s.default.AudioNode.call(this),this.createInsOuts(t,0),this._merger=this.output=this.context.createChannelMerger(t);for(var e=0;e<t;e++)this.input[e]=new s.default.Gain,this.input[e].connect(this._merger,0,e),this.input[e].channelCount=1,this.input[e].channelCountMode="explicit";this.left=this.input[0],this.right=this.input[1]},s.default.extend(s.default.Merge,s.default.AudioNode),s.default.Merge.prototype.dispose=function(){return this.input.forEach(function(t){t.dispose()}),s.default.AudioNode.prototype.dispose.call(this),this.left=null,this.right=null,this._merger.disconnect(),this._merger=null,this},e.default=s.default.Merge},function(t,e,i){"use strict";i.r(e);var s=i(0);i(35),i(4);s.default.supported&&(AudioBuffer.prototype.copyToChannel||(AudioBuffer.prototype.copyToChannel=function(t,e,i){var s=this.getChannelData(e);i=i||0;for(var n=0;n<s.length;n++)s[n+i]=t[n]},AudioBuffer.prototype.copyFromChannel=function(t,e,i){var s=this.getChannelData(e);i=i||0;for(var n=0;n<t.length;n++)t[n]=s[n+i]})),s.default.Buffer=function(){var t=s.default.defaults(arguments,["url","onload","onerror"],s.default.Buffer);s.default.call(this),this._buffer=null,this._reversed=t.reverse,this._xhr=null,this.onload=s.default.noOp,t.url instanceof AudioBuffer||t.url instanceof s.default.Buffer?(this.set(t.url),this.loaded||(this.onload=t.onload)):s.default.isString(t.url)&&this.load(t.url).then(t.onload).catch(t.onerror)},s.default.extend(s.default.Buffer),s.default.Buffer.defaults={url:void 0,reverse:!1,onload:s.default.noOp,onerror:s.default.noOp},s.default.Buffer.prototype.set=function(t){return t instanceof s.default.Buffer?t.loaded?this._buffer=t.get():t.onload=function(){this.set(t),this.onload(this)}.bind(this):this._buffer=t,this._reversed&&this._reverse(),this},s.default.Buffer.prototype.get=function(){return this._buffer},s.default.Buffer.prototype.load=function(t,e,i){return new Promise(function(n,o){this._xhr=s.default.Buffer.load(t,function(t){this._xhr=null,this.set(t),n(this),this.onload(this),e&&e(this)}.bind(this),function(t){this._xhr=null,o(t),i&&i(t)}.bind(this))}.bind(this))},s.default.Buffer.prototype.dispose=function(){return s.default.prototype.dispose.call(this),this._buffer=null,this._xhr&&(s.default.Buffer._removeFromDownloadQueue(this._xhr),this._xhr.abort(),this._xhr=null),this},Object.defineProperty(s.default.Buffer.prototype,"loaded",{get:function(){return this.length>0}}),Object.defineProperty(s.default.Buffer.prototype,"duration",{get:function(){return this._buffer?this._buffer.duration:0}}),Object.defineProperty(s.default.Buffer.prototype,"length",{get:function(){return this._buffer?this._buffer.length:0}}),Object.defineProperty(s.default.Buffer.prototype,"numberOfChannels",{get:function(){return this._buffer?this._buffer.numberOfChannels:0}}),s.default.Buffer.prototype.fromArray=function(t){var e=t[0].length>0,i=e?t.length:1,s=e?t[0].length:t.length,n=this.context.createBuffer(i,s,this.context.sampleRate);e||1!==i||(t=[t]);for(var o=0;o<i;o++)n.copyToChannel(t[o],o);return this._buffer=n,this},s.default.Buffer.prototype.toMono=function(t){if(s.default.isNumber(t))this.fromArray(this.toArray(t));else{for(var e=new Float32Array(this.length),i=this.numberOfChannels,n=0;n<i;n++)for(var o=this.toArray(n),a=0;a<o.length;a++)e[a]+=o[a];e=e.map(function(t){return t/i}),this.fromArray(e)}return this},s.default.Buffer.prototype.toArray=function(t){if(s.default.isNumber(t))return this.getChannelData(t);if(1===this.numberOfChannels)return this.toArray(0);for(var e=[],i=0;i<this.numberOfChannels;i++)e[i]=this.getChannelData(i);return e},s.default.Buffer.prototype.getChannelData=function(t){return this._buffer.getChannelData(t)},s.default.Buffer.prototype.slice=function(t,e){e=s.default.defaultArg(e,this.duration);for(var i=Math.floor(this.context.sampleRate*this.toSeconds(t)),n=Math.floor(this.context.sampleRate*this.toSeconds(e)),o=[],a=0;a<this.numberOfChannels;a++)o[a]=this.toArray(a).slice(i,n);return(new s.default.Buffer).fromArray(o)},s.default.Buffer.prototype._reverse=function(){if(this.loaded)for(var t=0;t<this.numberOfChannels;t++)Array.prototype.reverse.call(this.getChannelData(t));return this},Object.defineProperty(s.default.Buffer.prototype,"reverse",{get:function(){return this._reversed},set:function(t){this._reversed!==t&&(this._reversed=t,this._reverse())}}),s.default.Emitter.mixin(s.default.Buffer),s.default.Buffer._downloadQueue=[],s.default.Buffer.baseUrl="",s.default.Buffer.fromArray=function(t){return(new s.default.Buffer).fromArray(t)},s.default.Buffer.fromUrl=function(t){var e=new s.default.Buffer;return e.load(t).then(function(){return e})},s.default.Buffer._removeFromDownloadQueue=function(t){var e=s.default.Buffer._downloadQueue.indexOf(t);-1!==e&&s.default.Buffer._downloadQueue.splice(e,1)},s.default.Buffer.load=function(t,e,i){e=s.default.defaultArg(e,s.default.noOp);var n=t.match(/\[(.+\|?)+\]$/);if(n){for(var o=n[1].split("|"),a=o[0],r=0;r<o.length;r++)if(s.default.Buffer.supportsType(o[r])){a=o[r];break}t=t.replace(n[0],a)}function l(t){if(s.default.Buffer._removeFromDownloadQueue(d),s.default.Buffer.emit("error",t),!i)throw t;i(t)}function u(){for(var t=0,e=0;e<s.default.Buffer._downloadQueue.length;e++)t+=s.default.Buffer._downloadQueue[e].progress;s.default.Buffer.emit("progress",t/s.default.Buffer._downloadQueue.length)}var d=new XMLHttpRequest;return d.open("GET",s.default.Buffer.baseUrl+t,!0),d.responseType="arraybuffer",d.progress=0,s.default.Buffer._downloadQueue.push(d),d.addEventListener("load",function(){200===d.status?s.default.context.decodeAudioData(d.response).then(function(t){d.progress=1,u(),e(t),s.default.Buffer._removeFromDownloadQueue(d),0===s.default.Buffer._downloadQueue.length&&s.default.Buffer.emit("load")}).catch(function(){s.default.Buffer._removeFromDownloadQueue(d),l("Tone.Buffer: could not decode audio data: "+t)}):l("Tone.Buffer: could not locate file: "+t)}),d.addEventListener("error",l),d.addEventListener("progress",function(t){t.lengthComputable&&(d.progress=t.loaded/t.total*.95,u())}),d.send(),d},s.default.Buffer.cancelDownloads=function(){return s.default.Buffer._downloadQueue.slice().forEach(function(t){s.default.Buffer._removeFromDownloadQueue(t),t.abort()}),s.default.Buffer},s.default.Buffer.supportsType=function(t){var e=t.split(".");return e=e[e.length-1],""!==document.createElement("audio").canPlayType("audio/"+e)},s.default.loaded=function(){var t,e;function i(){s.default.Buffer.off("load",t),s.default.Buffer.off("error",e)}return new Promise(function(i,n){t=function(){i()},e=function(){n()},s.default.Buffer.on("load",t),s.default.Buffer.on("error",e)}).then(i).catch(function(t){throw i(),new Error(t)})};e.default=s.default.Buffer},function(t,e,i){"use strict";i.r(e);var s=i(0);i(17),i(26),i(1),i(2),i(22),i(4),i(28);s.default.LFO=function(){var t=s.default.defaults(arguments,["frequency","min","max"],s.default.LFO);s.default.AudioNode.call(this),this._oscillator=new s.default.Oscillator({frequency:t.frequency,type:t.type}),this.frequency=this._oscillator.frequency,this.amplitude=this._oscillator.volume,this.amplitude.units=s.default.Type.NormalRange,this.amplitude.value=t.amplitude,this._stoppedSignal=new s.default.Signal(0,s.default.Type.AudioRange),this._zeros=new s.default.Zero,this._stoppedValue=0,this._a2g=new s.default.AudioToGain,this._scaler=this.output=new s.default.Scale(t.min,t.max),this._units=s.default.Type.Default,this.units=t.units,this._oscillator.chain(this._a2g,this._scaler),this._zeros.connect(this._a2g),this._stoppedSignal.connect(this._a2g),this._readOnly(["amplitude","frequency"]),this.phase=t.phase},s.default.extend(s.default.LFO,s.default.AudioNode),s.default.LFO.defaults={type:"sine",min:0,max:1,phase:0,frequency:"4n",amplitude:1,units:s.default.Type.Default},s.default.LFO.prototype.start=function(t){return t=this.toSeconds(t),this._stoppedSignal.setValueAtTime(0,t),this._oscillator.start(t),this},s.default.LFO.prototype.stop=function(t){return t=this.toSeconds(t),this._stoppedSignal.setValueAtTime(this._stoppedValue,t),this._oscillator.stop(t),this},s.default.LFO.prototype.sync=function(){return this._oscillator.sync(),this._oscillator.syncFrequency(),this},s.default.LFO.prototype.unsync=function(){return this._oscillator.unsync(),this._oscillator.unsyncFrequency(),this},Object.defineProperty(s.default.LFO.prototype,"min",{get:function(){return this._toUnits(this._scaler.min)},set:function(t){t=this._fromUnits(t),this._scaler.min=t}}),Object.defineProperty(s.default.LFO.prototype,"max",{get:function(){return this._toUnits(this._scaler.max)},set:function(t){t=this._fromUnits(t),this._scaler.max=t}}),Object.defineProperty(s.default.LFO.prototype,"type",{get:function(){return this._oscillator.type},set:function(t){this._oscillator.type=t,this._stoppedValue=this._oscillator._getInitialValue(),this._stoppedSignal.value=this._stoppedValue}}),Object.defineProperty(s.default.LFO.prototype,"phase",{get:function(){return this._oscillator.phase},set:function(t){this._oscillator.phase=t,this._stoppedValue=this._oscillator._getInitialValue(),this._stoppedSignal.value=this._stoppedValue}}),Object.defineProperty(s.default.LFO.prototype,"units",{get:function(){return this._units},set:function(t){var e=this.min,i=this.max;this._units=t,this.min=e,this.max=i}}),Object.defineProperty(s.default.LFO.prototype,"state",{get:function(){return this._oscillator.state}}),s.default.LFO.prototype.connect=function(t){return t.constructor!==s.default.Signal&&t.constructor!==s.default.Param||(this.convert=t.convert,this.units=t.units),s.default.SignalBase.prototype.connect.apply(this,arguments),this},s.default.LFO.prototype._fromUnits=s.default.Param.prototype._fromUnits,s.default.LFO.prototype._toUnits=s.default.Param.prototype._toUnits,s.default.LFO.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["amplitude","frequency"]),this._oscillator.dispose(),this._oscillator=null,this._stoppedSignal.dispose(),this._stoppedSignal=null,this._zeros.dispose(),this._zeros=null,this._scaler.dispose(),this._scaler=null,this._a2g.dispose(),this._a2g=null,this.frequency=null,this.amplitude=null,this},e.default=s.default.LFO},function(t,e,i){"use strict";i.r(e);var s=i(0);i(29),i(90),i(2),i(3);s.default.Subtract=function(t){s.default.Signal.call(this),this.createInsOuts(2,0),this._sum=this.input[0]=this.output=new s.default.Gain,this._neg=new s.default.Negate,this._param=this.input[1]=new s.default.Signal(t),this._param.chain(this._neg,this._sum)},s.default.extend(s.default.Subtract,s.default.Signal),s.default.Subtract.prototype.dispose=function(){return s.default.Signal.prototype.dispose.call(this),this._neg.dispose(),this._neg=null,this._sum.disconnect(),this._sum=null,this},e.default=s.default.Subtract},function(t,e,i){"use strict";i.r(e);var s=i(0);i(4),i(1),i(24);s.default.Param=function(){var t=s.default.defaults(arguments,["param","units","convert"],s.default.Param);s.default.AudioNode.call(this,t),this._param=this.input=t.param,this.units=t.units,this.convert=t.convert,this.overridden=!1,this._events=new s.default.Timeline(1e3),s.default.isDefined(t.value)&&this._param&&this.setValueAtTime(t.value,0)},s.default.extend(s.default.Param,s.default.AudioNode),s.default.Param.defaults={units:s.default.Type.Default,convert:!0,param:void 0},Object.defineProperty(s.default.Param.prototype,"value",{get:function(){var t=this.now();return this._toUnits(this.getValueAtTime(t))},set:function(t){this._initialValue=this._fromUnits(t),this.cancelScheduledValues(this.now()),this.setValueAtTime(t,this.now())}}),Object.defineProperty(s.default.Param.prototype,"minValue",{get:function(){return this.units===s.default.Type.Time||this.units===s.default.Type.Frequency||this.units===s.default.Type.NormalRange||this.units===s.default.Type.Positive||this.units===s.default.Type.BPM?0:this.units===s.default.Type.AudioRange?-1:this.units===s.default.Type.Decibels?-1/0:this._param.minValue}}),Object.defineProperty(s.default.Param.prototype,"maxValue",{get:function(){return this.units===s.default.Type.NormalRange||this.units===s.default.Type.AudioRange?1:this._param.maxValue}}),s.default.Param.prototype._fromUnits=function(t){if(!this.convert&&!s.default.isUndef(this.convert)||this.overridden)return t;switch(this.units){case s.default.Type.Time:return this.toSeconds(t);case s.default.Type.Frequency:return this.toFrequency(t);case s.default.Type.Decibels:return s.default.dbToGain(t);case s.default.Type.NormalRange:return Math.min(Math.max(t,0),1);case s.default.Type.AudioRange:return Math.min(Math.max(t,-1),1);case s.default.Type.Positive:return Math.max(t,0);default:return t}},s.default.Param.prototype._toUnits=function(t){if(!this.convert&&!s.default.isUndef(this.convert))return t;switch(this.units){case s.default.Type.Decibels:return s.default.gainToDb(t);default:return t}},s.default.Param.prototype._minOutput=1e-5,s.default.Param.AutomationType={Linear:"linearRampToValueAtTime",Exponential:"exponentialRampToValueAtTime",Target:"setTargetAtTime",SetValue:"setValueAtTime",Cancel:"cancelScheduledValues"},s.default.Param.prototype.setValueAtTime=function(t,e){return e=this.toSeconds(e),t=this._fromUnits(t),this._events.add({type:s.default.Param.AutomationType.SetValue,value:t,time:e}),this.log(s.default.Param.AutomationType.SetValue,t,e),this._param.setValueAtTime(t,e),this},s.default.Param.prototype.getValueAtTime=function(t){t=this.toSeconds(t);var e=this._events.getAfter(t),i=this._events.get(t),n=s.default.defaultArg(this._initialValue,this._param.defaultValue),o=n;if(null===i)o=n;else if(i.type===s.default.Param.AutomationType.Target){var a,r=this._events.getBefore(i.time);a=null===r?n:r.value,o=this._exponentialApproach(i.time,a,i.value,i.constant,t)}else o=null===e?i.value:e.type===s.default.Param.AutomationType.Linear?this._linearInterpolate(i.time,i.value,e.time,e.value,t):e.type===s.default.Param.AutomationType.Exponential?this._exponentialInterpolate(i.time,i.value,e.time,e.value,t):i.value;return o},s.default.Param.prototype.setRampPoint=function(t){t=this.toSeconds(t);var e=this.getValueAtTime(t);return this.cancelAndHoldAtTime(t),0===e&&(e=this._minOutput),this.setValueAtTime(this._toUnits(e),t),this},s.default.Param.prototype.linearRampToValueAtTime=function(t,e){return t=this._fromUnits(t),e=this.toSeconds(e),this._events.add({type:s.default.Param.AutomationType.Linear,value:t,time:e}),this.log(s.default.Param.AutomationType.Linear,t,e),this._param.linearRampToValueAtTime(t,e),this},s.default.Param.prototype.exponentialRampToValueAtTime=function(t,e){return t=this._fromUnits(t),t=Math.max(this._minOutput,t),e=this.toSeconds(e),this._events.add({type:s.default.Param.AutomationType.Exponential,time:e,value:t}),this.log(s.default.Param.AutomationType.Exponential,t,e),this._param.exponentialRampToValueAtTime(t,e),this},s.default.Param.prototype.exponentialRampTo=function(t,e,i){return i=this.toSeconds(i),this.setRampPoint(i),this.exponentialRampToValueAtTime(t,i+this.toSeconds(e)),this},s.default.Param.prototype.linearRampTo=function(t,e,i){return i=this.toSeconds(i),this.setRampPoint(i),this.linearRampToValueAtTime(t,i+this.toSeconds(e)),this},s.default.Param.prototype.targetRampTo=function(t,e,i){return i=this.toSeconds(i),this.setRampPoint(i),this.exponentialApproachValueAtTime(t,i,e),this},s.default.Param.prototype.exponentialApproachValueAtTime=function(t,e,i){var s=Math.log(this.toSeconds(i)+1)/Math.log(200);return e=this.toSeconds(e),this.setTargetAtTime(t,e,s),this.cancelAndHoldAtTime(e+.9*i),this.linearRampToValueAtTime(t,e+i),this},s.default.Param.prototype.setTargetAtTime=function(t,e,i){if(t=this._fromUnits(t),i<=0)throw new Error("timeConstant must be greater than 0");return e=this.toSeconds(e),this._events.add({type:s.default.Param.AutomationType.Target,value:t,time:e,constant:i}),this.log(s.default.Param.AutomationType.Target,t,e,i),this._param.setTargetAtTime(t,e,i),this},s.default.Param.prototype.setValueCurveAtTime=function(t,e,i,n){n=s.default.defaultArg(n,1),i=this.toSeconds(i),e=this.toSeconds(e),this.setValueAtTime(t[0]*n,e);for(var o=i/(t.length-1),a=1;a<t.length;a++)this.linearRampToValueAtTime(t[a]*n,e+a*o);return this},s.default.Param.prototype.cancelScheduledValues=function(t){return t=this.toSeconds(t),this._events.cancel(t),this._param.cancelScheduledValues(t),this.log(s.default.Param.AutomationType.Cancel,t),this},s.default.Param.prototype.cancelAndHoldAtTime=function(t){t=this.toSeconds(t);var e=this.getValueAtTime(t);this.log("cancelAndHoldAtTime",t,"value="+e),this._param.cancelScheduledValues(t);var i=this._events.get(t),n=this._events.getAfter(t);return i&&i.time===t?n?this._events.cancel(n.time):this._events.cancel(t+this.sampleTime):n&&(this._events.cancel(n.time),n.type===s.default.Param.AutomationType.Linear?this.linearRampToValueAtTime(e,t):n.type===s.default.Param.AutomationType.Exponential&&this.exponentialRampToValueAtTime(e,t)),this._events.add({type:s.default.Param.AutomationType.SetValue,value:e,time:t}),this._param.setValueAtTime(e,t),this},s.default.Param.prototype.rampTo=function(t,e,i){return e=s.default.defaultArg(e,.1),this.units===s.default.Type.Frequency||this.units===s.default.Type.BPM||this.units===s.default.Type.Decibels?this.exponentialRampTo(t,e,i):this.linearRampTo(t,e,i),this},s.default.Param.prototype._exponentialApproach=function(t,e,i,s,n){return i+(e-i)*Math.exp(-(n-t)/s)},s.default.Param.prototype._linearInterpolate=function(t,e,i,s,n){return e+(n-t)/(i-t)*(s-e)},s.default.Param.prototype._exponentialInterpolate=function(t,e,i,s,n){return e*Math.pow(s/e,(n-t)/(i-t))},s.default.Param.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._param=null,this._events=null,this},e.default=s.default.Param},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(19),i(10),i(23);s.default.StereoEffect=function(){s.default.AudioNode.call(this);var t=s.default.defaults(arguments,["wet"],s.default.Effect);this.createInsOuts(1,1),this._dryWet=new s.default.CrossFade(t.wet),this.wet=this._dryWet.fade,this._split=new s.default.Split,this.effectSendL=this._split.left,this.effectSendR=this._split.right,this._merge=new s.default.Merge,this.effectReturnL=this._merge.left,this.effectReturnR=this._merge.right,s.default.connect(this.input,this._split),s.default.connect(this.input,this._dryWet,0,0),this._merge.connect(this._dryWet,0,1),this._dryWet.connect(this.output),this._readOnly(["wet"])},s.default.extend(s.default.StereoEffect,s.default.Effect),s.default.StereoEffect.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._dryWet.dispose(),this._dryWet=null,this._split.dispose(),this._split=null,this._merge.dispose(),this._merge=null,this.effectSendL=null,this.effectSendR=null,this.effectReturnL=null,this.effectReturnR=null,this._writable(["wet"]),this.wet=null,this},e.default=s.default.StereoEffect},function(t,e,i){"use strict";i.r(e);var s=i(0);i(83),i(4),i(24),i(35),i(3),i(81),i(80),i(56);s.default.Transport=function(){s.default.Emitter.call(this),s.default.getContext(function(){this.loop=!1,this._loopStart=0,this._loopEnd=0,this._ppq=n.defaults.PPQ,this._clock=new s.default.Clock({callback:this._processTick.bind(this),frequency:0}),this._bindClockEvents(),this.bpm=this._clock.frequency,this.bpm._toUnits=this._toUnits.bind(this),this.bpm._fromUnits=this._fromUnits.bind(this),this.bpm.units=s.default.Type.BPM,this.bpm.value=n.defaults.bpm,this._readOnly("bpm"),this._timeSignature=n.defaults.timeSignature,this._scheduledEvents={},this._timeline=new s.default.Timeline,this._repeatedEvents=new s.default.IntervalTimeline,this._syncedSignals=[],this._swingTicks=n.defaults.PPQ/2,this._swingAmount=0,this.context.transport=this}.bind(this))},s.default.extend(s.default.Transport,s.default.Emitter),s.default.Transport.defaults={bpm:120,swing:0,swingSubdivision:"8n",timeSignature:4,loopStart:0,loopEnd:"4m",PPQ:192},s.default.Transport.prototype.isTransport=!0,s.default.Transport.prototype._processTick=function(t,e){if(this._swingAmount>0&&e%this._ppq!=0&&e%(2*this._swingTicks)!=0){var i=e%(2*this._swingTicks)/(2*this._swingTicks),n=Math.sin(i*Math.PI)*this._swingAmount;t+=s.default.Ticks(2*this._swingTicks/3).toSeconds()*n}this.loop&&e>=this._loopEnd&&(this.emit("loopEnd",t),this._clock.setTicksAtTime(this._loopStart,t),e=this._loopStart,this.emit("loopStart",t,this._clock.getSecondsAtTime(t)),this.emit("loop",t)),this._timeline.forEachAtTime(e,function(e){e.invoke(t)})},s.default.Transport.prototype.schedule=function(t,e){var i=new s.default.TransportEvent(this,{time:s.default.TransportTime(e),callback:t});return this._addEvent(i,this._timeline)},s.default.Transport.prototype.scheduleRepeat=function(t,e,i,n){var o=new s.default.TransportRepeatEvent(this,{callback:t,interval:s.default.Time(e),time:s.default.TransportTime(i),duration:s.default.Time(s.default.defaultArg(n,1/0))});return this._addEvent(o,this._repeatedEvents)},s.default.Transport.prototype.scheduleOnce=function(t,e){var i=new s.default.TransportEvent(this,{time:s.default.TransportTime(e),callback:t,once:!0});return this._addEvent(i,this._timeline)},s.default.Transport.prototype.clear=function(t){if(this._scheduledEvents.hasOwnProperty(t)){var e=this._scheduledEvents[t.toString()];e.timeline.remove(e.event),e.event.dispose(),delete this._scheduledEvents[t.toString()]}return this},s.default.Transport.prototype._addEvent=function(t,e){return this._scheduledEvents[t.id.toString()]={event:t,timeline:e},e.add(t),t.id},s.default.Transport.prototype.cancel=function(t){return t=s.default.defaultArg(t,0),t=this.toTicks(t),this._timeline.forEachFrom(t,function(t){this.clear(t.id)}.bind(this)),this._repeatedEvents.forEachFrom(t,function(t){this.clear(t.id)}.bind(this)),this},s.default.Transport.prototype._bindClockEvents=function(){this._clock.on("start",function(t,e){e=s.default.Ticks(e).toSeconds(),this.emit("start",t,e)}.bind(this)),this._clock.on("stop",function(t){this.emit("stop",t)}.bind(this)),this._clock.on("pause",function(t){this.emit("pause",t)}.bind(this))},Object.defineProperty(s.default.Transport.prototype,"state",{get:function(){return this._clock.getStateAtTime(this.now())}}),s.default.Transport.prototype.start=function(t,e){return s.default.isDefined(e)&&(e=this.toTicks(e)),this._clock.start(t,e),this},s.default.Transport.prototype.stop=function(t){return this._clock.stop(t),this},s.default.Transport.prototype.pause=function(t){return this._clock.pause(t),this},s.default.Transport.prototype.toggle=function(t){return t=this.toSeconds(t),this._clock.getStateAtTime(t)!==s.default.State.Started?this.start(t):this.stop(t),this},Object.defineProperty(s.default.Transport.prototype,"timeSignature",{get:function(){return this._timeSignature},set:function(t){s.default.isArray(t)&&(t=t[0]/t[1]*4),this._timeSignature=t}}),Object.defineProperty(s.default.Transport.prototype,"loopStart",{get:function(){return s.default.Ticks(this._loopStart).toSeconds()},set:function(t){this._loopStart=this.toTicks(t)}}),Object.defineProperty(s.default.Transport.prototype,"loopEnd",{get:function(){return s.default.Ticks(this._loopEnd).toSeconds()},set:function(t){this._loopEnd=this.toTicks(t)}}),s.default.Transport.prototype.setLoopPoints=function(t,e){return this.loopStart=t,this.loopEnd=e,this},Object.defineProperty(s.default.Transport.prototype,"swing",{get:function(){return this._swingAmount},set:function(t){this._swingAmount=t}}),Object.defineProperty(s.default.Transport.prototype,"swingSubdivision",{get:function(){return s.default.Ticks(this._swingTicks).toNotation()},set:function(t){this._swingTicks=this.toTicks(t)}}),Object.defineProperty(s.default.Transport.prototype,"position",{get:function(){var t=this.now(),e=this._clock.getTicksAtTime(t);return s.default.Ticks(e).toBarsBeatsSixteenths()},set:function(t){var e=this.toTicks(t);this.ticks=e}}),Object.defineProperty(s.default.Transport.prototype,"seconds",{get:function(){return this._clock.seconds},set:function(t){var e=this.now(),i=this.bpm.timeToTicks(t,e);this.ticks=i}}),Object.defineProperty(s.default.Transport.prototype,"progress",{get:function(){if(this.loop){var t=this.now();return(this._clock.getTicksAtTime(t)-this._loopStart)/(this._loopEnd-this._loopStart)}return 0}}),Object.defineProperty(s.default.Transport.prototype,"ticks",{get:function(){return this._clock.ticks},set:function(t){if(this._clock.ticks!==t){var e=this.now();this.state===s.default.State.Started?(this.emit("stop",e),this._clock.setTicksAtTime(t,e),this.emit("start",e,this.seconds)):this._clock.setTicksAtTime(t,e)}}}),s.default.Transport.prototype.getTicksAtTime=function(t){return Math.round(this._clock.getTicksAtTime(t))},s.default.Transport.prototype.getSecondsAtTime=function(t){return this._clock.getSecondsAtTime(t)},Object.defineProperty(s.default.Transport.prototype,"PPQ",{get:function(){return this._ppq},set:function(t){var e=this.bpm.value;this._ppq=t,this.bpm.value=e}}),s.default.Transport.prototype._fromUnits=function(t){return 1/(60/t/this.PPQ)},s.default.Transport.prototype._toUnits=function(t){return t/this.PPQ*60},s.default.Transport.prototype.nextSubdivision=function(t){if(t=this.toTicks(t),this.state!==s.default.State.Started)return 0;var e=this.now(),i=t-this.getTicksAtTime(e)%t;return this._clock.nextTickTime(i,e)},s.default.Transport.prototype.syncSignal=function(t,e){if(!e){var i=this.now();e=0!==t.getValueAtTime(i)?t.getValueAtTime(i)/this.bpm.getValueAtTime(i):0}var n=new s.default.Gain(e);return this.bpm.chain(n,t._param),this._syncedSignals.push({ratio:n,signal:t,initial:t.value}),t.value=0,this},s.default.Transport.prototype.unsyncSignal=function(t){for(var e=this._syncedSignals.length-1;e>=0;e--){var i=this._syncedSignals[e];i.signal===t&&(i.ratio.dispose(),i.signal.value=i.initial,this._syncedSignals.splice(e,1))}return this},s.default.Transport.prototype.dispose=function(){return s.default.Emitter.prototype.dispose.call(this),this._clock.dispose(),this._clock=null,this._writable("bpm"),this.bpm=null,this._timeline.dispose(),this._timeline=null,this._repeatedEvents.dispose(),this._repeatedEvents=null,this};var n=s.default.Transport;s.default.Transport=new n,s.default.Context.on("init",function(t){t.transport&&t.transport.isTransport?s.default.Transport=t.transport:s.default.Transport=new n}),s.default.Context.on("close",function(t){t.transport&&t.transport.isTransport&&t.transport.dispose()}),e.default=s.default.Transport},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(6),i(16),i(64);s.default.Oscillator=function(){var t=s.default.defaults(arguments,["frequency","type"],s.default.Oscillator);s.default.Source.call(this,t),this._oscillator=null,this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this._wave=null,this._partials=t.partials,this._partialCount=t.partialCount,this._phase=t.phase,this._type=t.type,t.partialCount&&t.type!==s.default.Oscillator.Type.Custom&&(this._type=this.baseType+t.partialCount.toString()),this.phase=this._phase,this._readOnly(["frequency","detune"])},s.default.extend(s.default.Oscillator,s.default.Source),s.default.Oscillator.defaults={type:"sine",frequency:440,detune:0,phase:0,partials:[],partialCount:0},s.default.Oscillator.Type={Sine:"sine",Triangle:"triangle",Sawtooth:"sawtooth",Square:"square",Custom:"custom"},s.default.Oscillator.prototype._start=function(t){this.log("start",t);var e=new s.default.OscillatorNode;this._oscillator=e,this._wave?this._oscillator.setPeriodicWave(this._wave):this._oscillator.type=this._type,this._oscillator.connect(this.output),this.frequency.connect(this._oscillator.frequency),this.detune.connect(this._oscillator.detune),t=this.toSeconds(t),this._oscillator.start(t)},s.default.Oscillator.prototype._stop=function(t){return this.log("stop",t),this._oscillator&&(t=this.toSeconds(t),this._oscillator.stop(t)),this},s.default.Oscillator.prototype.restart=function(t){return this._oscillator&&this._oscillator.cancelStop(),this._state.cancel(this.toSeconds(t)),this},s.default.Oscillator.prototype.syncFrequency=function(){return s.default.Transport.syncSignal(this.frequency),this},s.default.Oscillator.prototype.unsyncFrequency=function(){return s.default.Transport.unsyncSignal(this.frequency),this},Object.defineProperty(s.default.Oscillator.prototype,"type",{get:function(){return this._type},set:function(t){var e=[s.default.Oscillator.Type.Sine,s.default.Oscillator.Type.Square,s.default.Oscillator.Type.Triangle,s.default.Oscillator.Type.Sawtooth].includes(t);if(0===this._phase&&e)this._wave=null,this._partialCount=0,null!==this._oscillator&&(this._oscillator.type=t);else{var i=this._getRealImaginary(t,this._phase),n=this.context.createPeriodicWave(i[0],i[1]);this._wave=n,null!==this._oscillator&&this._oscillator.setPeriodicWave(this._wave)}this._type=t}}),Object.defineProperty(s.default.Oscillator.prototype,"baseType",{get:function(){return this._type.replace(this.partialCount,"")},set:function(t){this.partialCount&&this._type!==s.default.Oscillator.Type.Custom&&t!==s.default.Oscillator.Type.Custom?this.type=t+this.partialCount:this.type=t}}),Object.defineProperty(s.default.Oscillator.prototype,"partialCount",{get:function(){return this._partialCount},set:function(t){var e=this._type,i=/^(sine|triangle|square|sawtooth)(\d+)$/.exec(this._type);i&&(e=i[1]),this._type!==s.default.Oscillator.Type.Custom&&(this.type=0===t?e:e+t.toString())}}),s.default.Oscillator.prototype.get=function(){var t=s.default.prototype.get.apply(this,arguments);return t.type!==s.default.Oscillator.Type.Custom&&delete t.partials,t},s.default.Oscillator.prototype._getRealImaginary=function(t,e){var i=2048,n=new Float32Array(i),o=new Float32Array(i),a=1;if(t===s.default.Oscillator.Type.Custom)a=this._partials.length+1,this._partialCount=this._partials.length,i=a;else{var r=/^(sine|triangle|square|sawtooth)(\d+)$/.exec(t);r?(a=parseInt(r[2])+1,this._partialCount=parseInt(r[2]),t=r[1],i=a=Math.max(a,2)):this._partialCount=0,this._partials=[]}for(var l=1;l<i;++l){var u,d=2/(l*Math.PI);switch(t){case s.default.Oscillator.Type.Sine:u=l<=a?1:0,this._partials[l-1]=u;break;case s.default.Oscillator.Type.Square:u=1&l?2*d:0,this._partials[l-1]=u;break;case s.default.Oscillator.Type.Sawtooth:u=d*(1&l?1:-1),this._partials[l-1]=u;break;case s.default.Oscillator.Type.Triangle:u=1&l?d*d*2*(l-1>>1&1?-1:1):0,this._partials[l-1]=u;break;case s.default.Oscillator.Type.Custom:u=this._partials[l-1];break;default:throw new TypeError("Tone.Oscillator: invalid type: "+t)}0!==u?(n[l]=-u*Math.sin(e*l),o[l]=u*Math.cos(e*l)):(n[l]=0,o[l]=0)}return[n,o]},s.default.Oscillator.prototype._inverseFFT=function(t,e,i){for(var s=0,n=t.length,o=0;o<n;o++)s+=t[o]*Math.cos(o*i)+e[o]*Math.sin(o*i);return s},s.default.Oscillator.prototype._getInitialValue=function(){for(var t=this._getRealImaginary(this._type,0),e=t[0],i=t[1],s=0,n=2*Math.PI,o=0;o<8;o++)s=Math.max(this._inverseFFT(e,i,o/8*n),s);return-this._inverseFFT(e,i,this._phase)/s},Object.defineProperty(s.default.Oscillator.prototype,"partials",{get:function(){return this._partials},set:function(t){this._partials=t,this.type=s.default.Oscillator.Type.Custom}}),Object.defineProperty(s.default.Oscillator.prototype,"phase",{get:function(){return this._phase*(180/Math.PI)},set:function(t){this._phase=t*Math.PI/180,this.type=this._type}}),s.default.Oscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),null!==this._oscillator&&(this._oscillator.dispose(),this._oscillator=null),this._wave=null,this._writable(["frequency","detune"]),this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null,this._partials=null,this},e.default=s.default.Oscillator},function(t,e,i){"use strict";i.r(e);var s=i(0);i(14),i(1);s.default.Delay=function(){var t=s.default.defaults(arguments,["delayTime","maxDelay"],s.default.Delay);s.default.AudioNode.call(this,t),this._maxDelay=Math.max(this.toSeconds(t.maxDelay),this.toSeconds(t.delayTime)),this._delayNode=this.input=this.output=this.context.createDelay(this._maxDelay),this.delayTime=new s.default.Param({param:this._delayNode.delayTime,units:s.default.Type.Time,value:t.delayTime}),this._readOnly("delayTime")},s.default.extend(s.default.Delay,s.default.AudioNode),s.default.Delay.defaults={maxDelay:1,delayTime:0},Object.defineProperty(s.default.Delay.prototype,"maxDelay",{get:function(){return this._maxDelay}}),s.default.Delay.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._delayNode.disconnect(),this._delayNode=null,this._writable("delayTime"),this.delayTime=null,this},e.default=s.default.Delay},function(t,e,i){"use strict";i.r(e);var s=i(0);i(3),i(1);s.default.Split=function(t){t=s.default.defaultArg(t,2),s.default.AudioNode.call(this),this.createInsOuts(0,t),this._splitter=this.input=this.context.createChannelSplitter(t);for(var e=0;e<t;e++)this.output[e]=new s.default.Gain,s.default.connect(this._splitter,this.output[e],e,0),this.output[e].channelCount=1,this.output[e].channelCountMode="explicit";this.left=this.output[0],this.right=this.output[1]},s.default.extend(s.default.Split,s.default.AudioNode),s.default.Split.prototype.dispose=function(){return this.output.forEach(function(t){t.dispose()}),s.default.AudioNode.prototype.dispose.call(this),this._splitter.disconnect(),this.left=null,this.right=null,this._splitter=null,this},e.default=s.default.Split},function(t,e,i){"use strict";i.r(e);var s=i(0),n=(i(35),i(24),i(44),["baseLatency","destination","currentTime","sampleRate","listener","state"]),o=["suspend","close","resume","getOutputTimestamp","createMediaElementSource","createMediaStreamSource","createMediaStreamDestination","createBuffer","decodeAudioData","createBufferSource","createConstantSource","createGain","createDelay","createBiquadFilter","createIIRFilter","createWaveShaper","createPanner","createConvolver","createDynamicsCompressor","createAnalyser","createScriptProcessor","createStereoPanner","createOscillator","createPeriodicWave","createChannelSplitter","createChannelMerger","audioWorklet"];s.default.Context=function(){s.default.Emitter.call(this);var t=s.default.defaults(arguments,["context"],s.default.Context);if(!t.context&&(t.context=new s.default.global.AudioContext,!t.context))throw new Error("could not create AudioContext. Possibly too many AudioContexts running already.");for(this._context=t.context;this._context.rawContext;)this._context=this._context.rawContext;n.forEach(function(t){this._defineProperty(this._context,t)}.bind(this)),o.forEach(function(t){this._defineMethod(this._context,t)}.bind(this)),this._latencyHint=t.latencyHint,this._constants={},this.lookAhead=t.lookAhead,this._computedUpdateInterval=0,this._ticker=new a(this.emit.bind(this,"tick"),t.clockSource,t.updateInterval),this._timeouts=new s.default.Timeline,this._timeoutIds=0,this.on("tick",this._timeoutLoop.bind(this)),this._context.onstatechange=function(t){this.emit("statechange",t)}.bind(this)},s.default.extend(s.default.Context,s.default.Emitter),s.default.Emitter.mixin(s.default.Context),s.default.Context.defaults={clockSource:"worker",latencyHint:"interactive",lookAhead:.1,updateInterval:.03},s.default.Context.prototype.isContext=!0,s.default.Context.prototype._defineProperty=function(t,e){s.default.isUndef(this[e])&&Object.defineProperty(this,e,{get:function(){return t[e]},set:function(i){t[e]=i}})},s.default.Context.prototype._defineMethod=function(t,e){s.default.isUndef(this[e])&&Object.defineProperty(this,e,{get:function(){return t[e].bind(t)}})},s.default.Context.prototype.now=function(){return this._context.currentTime+this.lookAhead},Object.defineProperty(s.default.Context.prototype,"destination",{get:function(){return this.master?this.master:this._context.destination}}),s.default.Context.prototype.resume=function(){return"suspended"===this._context.state&&this._context instanceof AudioContext?this._context.resume():Promise.resolve()},s.default.Context.prototype.close=function(){var t=Promise.resolve();return this!==s.default.global.TONE_AUDIO_CONTEXT&&(t=this.rawContext.close()),t.then(function(){s.default.Context.emit("close",this)}.bind(this))},s.default.Context.prototype.getConstant=function(t){if(this._constants[t])return this._constants[t];for(var e=this._context.createBuffer(1,128,this._context.sampleRate),i=e.getChannelData(0),s=0;s<i.length;s++)i[s]=t;var n=this._context.createBufferSource();return n.channelCount=1,n.channelCountMode="explicit",n.buffer=e,n.loop=!0,n.start(0),this._constants[t]=n,n},s.default.Context.prototype._timeoutLoop=function(){for(var t=this.now();this._timeouts&&this._timeouts.length&&this._timeouts.peek().time<=t;)this._timeouts.shift().callback()},s.default.Context.prototype.setTimeout=function(t,e){this._timeoutIds++;var i=this.now();return this._timeouts.add({callback:t,time:i+e,id:this._timeoutIds}),this._timeoutIds},s.default.Context.prototype.clearTimeout=function(t){return this._timeouts.forEach(function(e){e.id===t&&this.remove(e)}),this},Object.defineProperty(s.default.Context.prototype,"updateInterval",{get:function(){return this._ticker.updateInterval},set:function(t){this._ticker.updateInterval=t}}),Object.defineProperty(s.default.Context.prototype,"rawContext",{get:function(){return this._context}}),Object.defineProperty(s.default.Context.prototype,"clockSource",{get:function(){return this._ticker.type},set:function(t){this._ticker.type=t}}),Object.defineProperty(s.default.Context.prototype,"latencyHint",{get:function(){return this._latencyHint},set:function(t){var e=t;if(this._latencyHint=t,s.default.isString(t))switch(t){case"interactive":e=.1,this._context.latencyHint=t;break;case"playback":e=.8,this._context.latencyHint=t;break;case"balanced":e=.25,this._context.latencyHint=t;break;case"fastest":this._context.latencyHint="interactive",e=.01}this.lookAhead=e,this.updateInterval=e/3}}),s.default.Context.prototype.dispose=function(){return this.close().then(function(){for(var t in s.default.Emitter.prototype.dispose.call(this),this._ticker.dispose(),this._ticker=null,this._timeouts.dispose(),this._timeouts=null,this._constants)this._constants[t].disconnect();this._constants=null}.bind(this))};var a=function(t,e,i){this._type=e,this._updateInterval=i,this._callback=s.default.defaultArg(t,s.default.noOp),this._createClock()};if(a.Type={Worker:"worker",Timeout:"timeout",Offline:"offline"},a.prototype._createWorker=function(){s.default.global.URL=s.default.global.URL||s.default.global.webkitURL;var t=new Blob(["var timeoutTime = "+(1e3*this._updateInterval).toFixed(1)+";self.onmessage = function(msg){\ttimeoutTime = parseInt(msg.data);};function tick(){\tsetTimeout(tick, timeoutTime);\tself.postMessage('tick');}tick();"]),e=URL.createObjectURL(t),i=new Worker(e);i.onmessage=this._callback.bind(this),this._worker=i},a.prototype._createTimeout=function(){this._timeout=setTimeout(function(){this._createTimeout(),this._callback()}.bind(this),1e3*this._updateInterval)},a.prototype._createClock=function(){if(this._type===a.Type.Worker)try{this._createWorker()}catch(t){this._type=a.Type.Timeout,this._createClock()}else this._type===a.Type.Timeout&&this._createTimeout()},Object.defineProperty(a.prototype,"updateInterval",{get:function(){return this._updateInterval},set:function(t){this._updateInterval=Math.max(t,128/44100),this._type===a.Type.Worker&&this._worker.postMessage(Math.max(1e3*t,1))}}),Object.defineProperty(a.prototype,"type",{get:function(){return this._type},set:function(t){this._disposeClock(),this._type=t,this._createClock()}}),a.prototype._disposeClock=function(){this._timeout&&(clearTimeout(this._timeout),this._timeout=null),this._worker&&(this._worker.terminate(),this._worker.onmessage=null,this._worker=null)},a.prototype.dispose=function(){this._disposeClock(),this._callback=null},s.default.supported&&!s.default.initialized){if(s.default.global.TONE_AUDIO_CONTEXT||(s.default.global.TONE_AUDIO_CONTEXT=new s.default.Context),s.default.context=s.default.global.TONE_AUDIO_CONTEXT,!s.default.global.TONE_SILENCE_LOGGING){var r="v";"dev"===s.default.version&&(r="");var l=" * Tone.js "+r+s.default.version+" * ";console.log("%c"+l,"background: #000; color: #fff")}}else s.default.supported||s.default.global.TONE_SILENCE_LOGGING||console.warn("This browser does not support Tone.js");e.default=s.default.Context},function(t,e,i){"use strict";i.r(e);var s=i(0);i(4),i(40);s.default.Instrument=function(t){t=s.default.defaultArg(t,s.default.Instrument.defaults),s.default.AudioNode.call(this),this._volume=this.output=new s.default.Volume(t.volume),this.volume=this._volume.volume,this._readOnly("volume"),this._scheduledEvents=[]},s.default.extend(s.default.Instrument,s.default.AudioNode),s.default.Instrument.defaults={volume:0},s.default.Instrument.prototype.triggerAttack=s.default.noOp,s.default.Instrument.prototype.triggerRelease=s.default.noOp,s.default.Instrument.prototype.sync=function(){return this._syncMethod("triggerAttack",1),this._syncMethod("triggerRelease",0),this},s.default.Instrument.prototype._syncMethod=function(t,e){var i=this["_original_"+t]=this[t];this[t]=function(){var t=Array.prototype.slice.call(arguments),n=t[e],o=s.default.Transport.schedule(function(s){t[e]=s,i.apply(this,t)}.bind(this),n);this._scheduledEvents.push(o)}.bind(this)},s.default.Instrument.prototype.unsync=function(){return this._scheduledEvents.forEach(function(t){s.default.Transport.clear(t)}),this._scheduledEvents=[],this._original_triggerAttack&&(this.triggerAttack=this._original_triggerAttack,this.triggerRelease=this._original_triggerRelease),this},s.default.Instrument.prototype.triggerAttackRelease=function(t,e,i,s){return i=this.toSeconds(i),e=this.toSeconds(e),this.triggerAttack(t,i,s),this.triggerRelease(i+e),this},s.default.Instrument.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._volume.dispose(),this._volume=null,this._writable(["volume"]),this.volume=null,this.unsync(),this._scheduledEvents=null,this},e.default=s.default.Instrument},function(t,e,i){"use strict";i.r(e);var s=i(0);i(7),i(2);s.default.AudioToGain=function(){s.default.SignalBase.call(this),this._norm=this.input=this.output=new s.default.WaveShaper(function(t){return(t+1)/2})},s.default.extend(s.default.AudioToGain,s.default.SignalBase),s.default.AudioToGain.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._norm.dispose(),this._norm=null,this},e.default=s.default.AudioToGain},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(13),i(89),i(3),i(1);s.default.CrossFade=function(t){s.default.AudioNode.call(this),this.createInsOuts(2,1),this.a=this.input[0]=new s.default.Gain,this.b=this.input[1]=new s.default.Gain,this.fade=new s.default.Signal(s.default.defaultArg(t,.5),s.default.Type.NormalRange),this._equalPowerA=new s.default.EqualPowerGain,this._equalPowerB=new s.default.EqualPowerGain,this._one=this.context.getConstant(1),this._invert=new s.default.Subtract,this.a.connect(this.output),this.b.connect(this.output),this.fade.chain(this._equalPowerB,this.b.gain),s.default.connect(this._one,this._invert,0,0),this.fade.connect(this._invert,0,1),this._invert.chain(this._equalPowerA,this.a.gain),this._readOnly("fade")},s.default.extend(s.default.CrossFade,s.default.AudioNode),s.default.CrossFade.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable("fade"),this._equalPowerA.dispose(),this._equalPowerA=null,this._equalPowerB.dispose(),this._equalPowerB=null,this.fade.dispose(),this.fade=null,this._invert.dispose(),this._invert=null,this._one=null,this.a.dispose(),this.a=null,this.b.dispose(),this.b=null,this},e.default=s.default.CrossFade},function(t,e,i){"use strict";i.r(e);var s=i(0);s.default.Timeline=function(){var t=s.default.defaults(arguments,["memory"],s.default.Timeline);s.default.call(this),this._timeline=[],this.memory=t.memory},s.default.extend(s.default.Timeline),s.default.Timeline.defaults={memory:1/0},Object.defineProperty(s.default.Timeline.prototype,"length",{get:function(){return this._timeline.length}}),s.default.Timeline.prototype.add=function(t){if(s.default.isUndef(t.time))throw new Error("Tone.Timeline: events must have a time attribute");t.time=t.time.valueOf();var e=this._search(t.time);if(this._timeline.splice(e+1,0,t),this.length>this.memory){var i=this.length-this.memory;this._timeline.splice(0,i)}return this},s.default.Timeline.prototype.remove=function(t){var e=this._timeline.indexOf(t);return-1!==e&&this._timeline.splice(e,1),this},s.default.Timeline.prototype.get=function(t,e){e=s.default.defaultArg(e,"time");var i=this._search(t,e);return-1!==i?this._timeline[i]:null},s.default.Timeline.prototype.peek=function(){return this._timeline[0]},s.default.Timeline.prototype.shift=function(){return this._timeline.shift()},s.default.Timeline.prototype.getAfter=function(t,e){e=s.default.defaultArg(e,"time");var i=this._search(t,e);return i+1<this._timeline.length?this._timeline[i+1]:null},s.default.Timeline.prototype.getBefore=function(t,e){e=s.default.defaultArg(e,"time");var i=this._timeline.length;if(i>0&&this._timeline[i-1][e]<t)return this._timeline[i-1];var n=this._search(t,e);return n-1>=0?this._timeline[n-1]:null},s.default.Timeline.prototype.cancel=function(t){if(this._timeline.length>1){var e=this._search(t);if(e>=0)if(this._timeline[e].time===t){for(var i=e;i>=0&&this._timeline[i].time===t;i--)e=i;this._timeline=this._timeline.slice(0,e)}else this._timeline=this._timeline.slice(0,e+1);else this._timeline=[]}else 1===this._timeline.length&&this._timeline[0].time>=t&&(this._timeline=[]);return this},s.default.Timeline.prototype.cancelBefore=function(t){var e=this._search(t);return e>=0&&(this._timeline=this._timeline.slice(e+1)),this},s.default.Timeline.prototype.previousEvent=function(t){var e=this._timeline.indexOf(t);return e>0?this._timeline[e-1]:null},s.default.Timeline.prototype._search=function(t,e){if(0===this._timeline.length)return-1;e=s.default.defaultArg(e,"time");var i=0,n=this._timeline.length,o=n;if(n>0&&this._timeline[n-1][e]<=t)return n-1;for(;i<o;){var a=Math.floor(i+(o-i)/2),r=this._timeline[a],l=this._timeline[a+1];if(r[e]===t){for(var u=a;u<this._timeline.length;u++){this._timeline[u][e]===t&&(a=u)}return a}if(r[e]<t&&l[e]>t)return a;r[e]>t?o=a:i=a+1}return-1},s.default.Timeline.prototype._iterate=function(t,e,i){e=s.default.defaultArg(e,0),i=s.default.defaultArg(i,this._timeline.length-1),this._timeline.slice(e,i+1).forEach(function(e){t.call(this,e)}.bind(this))},s.default.Timeline.prototype.forEach=function(t){return this._iterate(t),this},s.default.Timeline.prototype.forEachBefore=function(t,e){var i=this._search(t);return-1!==i&&this._iterate(e,0,i),this},s.default.Timeline.prototype.forEachAfter=function(t,e){var i=this._search(t);return this._iterate(e,i+1),this},s.default.Timeline.prototype.forEachBetween=function(t,e,i){var s=this._search(t),n=this._search(e);return-1!==s&&-1!==n?(this._timeline[s].time!==t&&(s+=1),this._timeline[n].time===e&&(n-=1),this._iterate(i,s,n)):-1===s&&this._iterate(i,0,n),this},s.default.Timeline.prototype.forEachFrom=function(t,e){for(var i=this._search(t);i>=0&&this._timeline[i].time>=t;)i--;return this._iterate(e,i+1),this},s.default.Timeline.prototype.forEachAtTime=function(t,e){var i=this._search(t);return-1!==i&&this._iterate(function(i){i.time===t&&e.call(this,i)},0,i),this},s.default.Timeline.prototype.dispose=function(){return s.default.prototype.dispose.call(this),this._timeline=null,this},e.default=s.default.Timeline},function(t,e,i){"use strict";i.r(e);var s=i(0);i(21),i(2);s.default.Monophonic=function(t){t=s.default.defaultArg(t,s.default.Monophonic.defaults),s.default.Instrument.call(this,t),this.portamento=t.portamento},s.default.extend(s.default.Monophonic,s.default.Instrument),s.default.Monophonic.defaults={portamento:0},s.default.Monophonic.prototype.triggerAttack=function(t,e,i){return this.log("triggerAttack",t,e,i),e=this.toSeconds(e),this._triggerEnvelopeAttack(e,i),this.setNote(t,e),this},s.default.Monophonic.prototype.triggerRelease=function(t){return this.log("triggerRelease",t),t=this.toSeconds(t),this._triggerEnvelopeRelease(t),this},s.default.Monophonic.prototype._triggerEnvelopeAttack=function(){},s.default.Monophonic.prototype._triggerEnvelopeRelease=function(){},s.default.Monophonic.prototype.getLevelAtTime=function(t){return t=this.toSeconds(t),this.envelope.getValueAtTime(t)},s.default.Monophonic.prototype.setNote=function(t,e){if(e=this.toSeconds(e),this.portamento>0&&this.getLevelAtTime(e)>.05){var i=this.toSeconds(this.portamento);this.frequency.exponentialRampTo(t,i,e)}else this.frequency.setValueAtTime(t,e);return this},e.default=s.default.Monophonic},function(t,e,i){"use strict";i.r(e);var s=i(0);i(29),i(5),i(2);s.default.Scale=function(t,e){s.default.SignalBase.call(this),this._outputMin=s.default.defaultArg(t,0),this._outputMax=s.default.defaultArg(e,1),this._scale=this.input=new s.default.Multiply(1),this._add=this.output=new s.default.Add(0),this._scale.connect(this._add),this._setRange()},s.default.extend(s.default.Scale,s.default.SignalBase),Object.defineProperty(s.default.Scale.prototype,"min",{get:function(){return this._outputMin},set:function(t){this._outputMin=t,this._setRange()}}),Object.defineProperty(s.default.Scale.prototype,"max",{get:function(){return this._outputMax},set:function(t){this._outputMax=t,this._setRange()}}),s.default.Scale.prototype._setRange=function(){this._add.value=this._outputMin,this._scale.value=this._outputMax-this._outputMin},s.default.Scale.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._add.dispose(),this._add=null,this._scale.dispose(),this._scale=null,this},e.default=s.default.Scale},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(3),i(1);s.default.Volume=function(){var t=s.default.defaults(arguments,["volume"],s.default.Volume);s.default.AudioNode.call(this,t),this.output=this.input=new s.default.Gain(t.volume,s.default.Type.Decibels),this._unmutedVolume=t.volume,this.volume=this.output.gain,this._readOnly("volume"),this.mute=t.mute},s.default.extend(s.default.Volume,s.default.AudioNode),s.default.Volume.defaults={volume:0,mute:!1},Object.defineProperty(s.default.Volume.prototype,"mute",{get:function(){return this.volume.value===-1/0},set:function(t){!this.mute&&t?(this._unmutedVolume=this.volume.value,this.volume.value=-1/0):this.mute&&!t&&(this.volume.value=this._unmutedVolume)}}),s.default.Volume.prototype.dispose=function(){return this.input.dispose(),s.default.AudioNode.prototype.dispose.call(this),this._writable("volume"),this.volume.dispose(),this.volume=null,this},e.default=s.default.Volume},function(t,e,i){"use strict";i.r(e);var s=i(0);i(3),i(30);s.default.Zero=function(){s.default.SignalBase.call(this),this._gain=this.input=this.output=new s.default.Gain,s.default.connect(this.context.getConstant(0),this._gain)},s.default.extend(s.default.Zero,s.default.SignalBase),s.default.Zero.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._gain.dispose(),this._gain=null,this},e.default=s.default.Zero},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(3);s.default.Add=function(t){s.default.Signal.call(this),this.createInsOuts(2,0),this._sum=this.input[0]=this.input[1]=this.output=new s.default.Gain,this._param=this.input[1]=new s.default.Signal(t),this._param.connect(this._sum)},s.default.extend(s.default.Add,s.default.Signal),s.default.Add.prototype.dispose=function(){return s.default.Signal.prototype.dispose.call(this),this._sum.dispose(),this._sum=null,this},e.default=s.default.Add},function(t,e,i){"use strict";i.r(e);var s=i(0);i(1);s.default.SignalBase=function(){s.default.AudioNode.call(this)},s.default.extend(s.default.SignalBase,s.default.AudioNode),s.default.SignalBase.prototype.connect=function(t,e,i){return s.default.Signal&&s.default.Signal===t.constructor||s.default.Param&&s.default.Param===t.constructor?(t._param.cancelScheduledValues(0),t._param.setValueAtTime(0,0),t.overridden=!0):t instanceof AudioParam&&(t.cancelScheduledValues(0),t.setValueAtTime(0,0)),s.default.AudioNode.prototype.connect.call(this,t,e,i),this},e.default=s.default.SignalBase},function(t,e,i){"use strict";i.r(e);var s=i(0);i(47),i(3);s.default.AmplitudeEnvelope=function(){s.default.Envelope.apply(this,arguments),this.input=this.output=new s.default.Gain,this._sig.connect(this.output.gain)},s.default.extend(s.default.AmplitudeEnvelope,s.default.Envelope),s.default.AmplitudeEnvelope.prototype.dispose=function(){return s.default.Envelope.prototype.dispose.call(this),this},e.default=s.default.AmplitudeEnvelope},function(t,e,i){"use strict";i.r(e);var s=i(0);i(11),i(6),i(3),i(1);s.default.BufferSource=function(){var t=s.default.defaults(arguments,["buffer","onload"],s.default.BufferSource);s.default.AudioNode.call(this,t),this.onended=t.onended,this._startTime=-1,this._sourceStarted=!1,this._sourceStopped=!1,this._stopTime=-1,this._gainNode=this.output=new s.default.Gain(0),this._source=this.context.createBufferSource(),s.default.connect(this._source,this._gainNode),this._source.onended=this._onended.bind(this),this._buffer=new s.default.Buffer(t.buffer,t.onload),this.playbackRate=new s.default.Param({param:this._source.playbackRate,units:s.default.Type.Positive,value:t.playbackRate}),this.fadeIn=t.fadeIn,this.fadeOut=t.fadeOut,this.curve=t.curve,this._onendedTimeout=-1,this.loop=t.loop,this.loopStart=t.loopStart,this.loopEnd=t.loopEnd},s.default.extend(s.default.BufferSource,s.default.AudioNode),s.default.BufferSource.defaults={onended:s.default.noOp,onload:s.default.noOp,loop:!1,loopStart:0,loopEnd:0,fadeIn:0,fadeOut:0,curve:"linear",playbackRate:1},Object.defineProperty(s.default.BufferSource.prototype,"state",{get:function(){return this.getStateAtTime(this.now())}}),s.default.BufferSource.prototype.getStateAtTime=function(t){return t=this.toSeconds(t),-1!==this._startTime&&this._startTime<=t&&(-1===this._stopTime||t<this._stopTime)&&!this._sourceStopped?s.default.State.Started:s.default.State.Stopped},s.default.BufferSource.prototype.start=function(t,e,i,n){this.log("start",t,e,i,n),this.assert(-1===this._startTime,"can only be started once"),this.assert(this.buffer.loaded,"buffer is either not set or not loaded"),this.assert(!this._sourceStopped,"source is already stopped"),t=this.toSeconds(t),e=this.loop?s.default.defaultArg(e,this.loopStart):s.default.defaultArg(e,0),e=this.toSeconds(e),e=Math.max(e,0),n=s.default.defaultArg(n,1);var o=this.toSeconds(this.fadeIn);if(o>0?(this._gainNode.gain.setValueAtTime(0,t),"linear"===this.curve?this._gainNode.gain.linearRampToValueAtTime(n,t+o):this._gainNode.gain.exponentialApproachValueAtTime(n,t,o)):this._gainNode.gain.setValueAtTime(n,t),this._startTime=t,s.default.isDefined(i)){var a=this.toSeconds(i);a=Math.max(a,0),this.stop(t+a)}if(this.loop){var r=this.loopEnd||this.buffer.duration,l=this.loopStart;e>=r&&(e=(e-l)%(r-l)+l)}return this._source.buffer=this.buffer.get(),this._source.loopEnd=this.loopEnd||this.buffer.duration,e<this.buffer.duration&&(this._sourceStarted=!0,this._source.start(t,e)),this},s.default.BufferSource.prototype.stop=function(t){this.log("stop",t),this.assert(this.buffer.loaded,"buffer is either not set or not loaded"),this.assert(!this._sourceStopped,"source is already stopped"),t=this.toSeconds(t),-1!==this._stopTime&&this.cancelStop();var e=this.toSeconds(this.fadeOut);return this._stopTime=t+e,e>0?"linear"===this.curve?this._gainNode.gain.linearRampTo(0,e,t):this._gainNode.gain.targetRampTo(0,e,t):(this._gainNode.gain.cancelAndHoldAtTime(t),this._gainNode.gain.setValueAtTime(0,t)),s.default.context.clearTimeout(this._onendedTimeout),this._onendedTimeout=s.default.context.setTimeout(this._onended.bind(this),this._stopTime-this.now()),this},s.default.BufferSource.prototype.cancelStop=function(){if(-1!==this._startTime&&!this._sourceStopped){var t=this.toSeconds(this.fadeIn);this._gainNode.gain.cancelScheduledValues(this._startTime+t+this.sampleTime),this.context.clearTimeout(this._onendedTimeout),this._stopTime=-1}return this},s.default.BufferSource.prototype._onended=function(){if(!this._sourceStopped){this._sourceStopped=!0;var t="exponential"===this.curve?2*this.fadeOut:0;this._sourceStarted&&-1!==this._stopTime&&this._source.stop(this._stopTime+t),this.onended(this),setTimeout(function(){this._source&&(this._source.disconnect(),this._gainNode.disconnect())}.bind(this),1e3*t+100)}},Object.defineProperty(s.default.BufferSource.prototype,"loopStart",{get:function(){return this._source.loopStart},set:function(t){this._source.loopStart=this.toSeconds(t)}}),Object.defineProperty(s.default.BufferSource.prototype,"loopEnd",{get:function(){return this._source.loopEnd},set:function(t){this._source.loopEnd=this.toSeconds(t)}}),Object.defineProperty(s.default.BufferSource.prototype,"buffer",{get:function(){return this._buffer},set:function(t){this._buffer.set(t)}}),Object.defineProperty(s.default.BufferSource.prototype,"loop",{get:function(){return this._source.loop},set:function(t){this._source.loop=t,this.cancelStop()}}),s.default.BufferSource.prototype.dispose=function(){return this._wasDisposed||(this._wasDisposed=!0,s.default.AudioNode.prototype.dispose.call(this),this.onended=null,this._source.onended=null,this._source.disconnect(),this._source=null,this._gainNode.dispose(),this._gainNode=null,this._buffer.dispose(),this._buffer=null,this._startTime=-1,this.playbackRate=null,s.default.context.clearTimeout(this._onendedTimeout)),this},e.default=s.default.BufferSource},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(2),i(5),i(3);s.default.FeedbackEffect=function(){var t=s.default.defaults(arguments,["feedback"],s.default.FeedbackEffect);s.default.Effect.call(this,t),this._feedbackGain=new s.default.Gain(t.feedback,s.default.Type.NormalRange),this.feedback=this._feedbackGain.gain,this.effectReturn.chain(this._feedbackGain,this.effectSend),this._readOnly(["feedback"])},s.default.extend(s.default.FeedbackEffect,s.default.Effect),s.default.FeedbackEffect.defaults={feedback:.125},s.default.FeedbackEffect.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._writable(["feedback"]),this._feedbackGain.dispose(),this._feedbackGain=null,this.feedback=null,this},e.default=s.default.FeedbackEffect},function(t,e,i){"use strict";i.r(e);var s=i(0);i(24),i(4);s.default.TimelineState=function(t){s.default.Timeline.call(this),this._initial=t},s.default.extend(s.default.TimelineState,s.default.Timeline),s.default.TimelineState.prototype.getValueAtTime=function(t){var e=this.get(t);return null!==e?e.state:this._initial},s.default.TimelineState.prototype.setStateAtTime=function(t,e){return this.add({state:t,time:e}),this},s.default.TimelineState.prototype.getLastState=function(t,e){e=this.toSeconds(e);for(var i=this._search(e);i>=0;i--){var s=this._timeline[i];if(s.state===t)return s}},s.default.TimelineState.prototype.getNextState=function(t,e){e=this.toSeconds(e);var i=this._search(e);if(-1!==i)for(var s=i;s<this._timeline.length;s++){var n=this._timeline[s];if(n.state===t)return n}},e.default=s.default.TimelineState},function(t,e,i){"use strict";i.r(e);var s=i(0);s.default.Emitter=function(){s.default.call(this),this._events={}},s.default.extend(s.default.Emitter),s.default.Emitter.prototype.on=function(t,e){for(var i=t.split(/\W+/),s=0;s<i.length;s++){var n=i[s];this._events.hasOwnProperty(n)||(this._events[n]=[]),this._events[n].push(e)}return this},s.default.Emitter.prototype.once=function(t,e){var i=function(){e.apply(this,arguments),this.off(t,i)}.bind(this);return this.on(t,i),this},s.default.Emitter.prototype.off=function(t,e){for(var i=t.split(/\W+/),n=0;n<i.length;n++)if(t=i[n],this._events.hasOwnProperty(t))if(s.default.isUndef(e))this._events[t]=[];else for(var o=this._events[t],a=0;a<o.length;a++)o[a]===e&&o.splice(a,1);return this},s.default.Emitter.prototype.emit=function(t){if(this._events){var e=Array.apply(null,arguments).slice(1);if(this._events.hasOwnProperty(t))for(var i=this._events[t].slice(0),s=0,n=i.length;s<n;s++)i[s].apply(this,e)}return this},s.default.Emitter.mixin=function(t){var e=["on","once","off","emit"];t._events={};for(var i=0;i<e.length;i++){var n=e[i],o=s.default.Emitter.prototype[n];t[n]=o}return s.default.Emitter},s.default.Emitter.prototype.dispose=function(){return s.default.prototype.dispose.call(this),this._events=null,this},e.default=s.default.Emitter},function(t,e,i){"use strict";i.r(e);var s=i(0);i(1),i(44);s.default.supported&&(AnalyserNode.prototype.getFloatTimeDomainData||(AnalyserNode.prototype.getFloatTimeDomainData=function(t){var e=new Uint8Array(t.length);this.getByteTimeDomainData(e);for(var i=0;i<e.length;i++)t[i]=(e[i]-128)/128})),s.default.Analyser=function(){var t=s.default.defaults(arguments,["type","size"],s.default.Analyser);s.default.AudioNode.call(this),this._analyser=this.input=this.output=this.context.createAnalyser(),this._type=t.type,this._buffer=null,this.size=t.size,this.type=t.type},s.default.extend(s.default.Analyser,s.default.AudioNode),s.default.Analyser.defaults={size:1024,type:"fft",smoothing:.8},s.default.Analyser.Type={Waveform:"waveform",FFT:"fft"},s.default.Analyser.prototype.getValue=function(){return this._type===s.default.Analyser.Type.FFT?this._analyser.getFloatFrequencyData(this._buffer):this._type===s.default.Analyser.Type.Waveform&&this._analyser.getFloatTimeDomainData(this._buffer),this._buffer},Object.defineProperty(s.default.Analyser.prototype,"size",{get:function(){return this._analyser.frequencyBinCount},set:function(t){this._analyser.fftSize=2*t,this._buffer=new Float32Array(t)}}),Object.defineProperty(s.default.Analyser.prototype,"type",{get:function(){return this._type},set:function(t){if(t!==s.default.Analyser.Type.Waveform&&t!==s.default.Analyser.Type.FFT)throw new TypeError("Tone.Analyser: invalid type: "+t);this._type=t}}),Object.defineProperty(s.default.Analyser.prototype,"smoothing",{get:function(){return this._analyser.smoothingTimeConstant},set:function(t){this._analyser.smoothingTimeConstant=t}}),s.default.Analyser.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._analyser.disconnect(),this._analyser=null,this._buffer=null};e.default=s.default.Analyser},function(t,e,i){"use strict";i.r(e);var s=i(0);i(6),i(17),i(50),i(69),i(49),i(68),i(67);s.default.OmniOscillator=function(){var t=s.default.defaults(arguments,["frequency","type"],s.default.OmniOscillator);s.default.Source.call(this,t),this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this._sourceType=void 0,this._oscillator=null,this.type=t.type,this._readOnly(["frequency","detune"]),this.set(t)},s.default.extend(s.default.OmniOscillator,s.default.Source),s.default.OmniOscillator.defaults={frequency:440,detune:0,type:"sine",phase:0};var n="PulseOscillator",o="PWMOscillator",a="Oscillator",r="FMOscillator",l="AMOscillator",u="FatOscillator";s.default.OmniOscillator.prototype._start=function(t){this._oscillator.start(t)},s.default.OmniOscillator.prototype._stop=function(t){this._oscillator.stop(t)},s.default.OmniOscillator.prototype.restart=function(t){this._oscillator.restart(t)},Object.defineProperty(s.default.OmniOscillator.prototype,"type",{get:function(){var t="";return this._sourceType===r?t="fm":this._sourceType===l?t="am":this._sourceType===u&&(t="fat"),t+this._oscillator.type},set:function(t){"fm"===t.substr(0,2)?(this._createNewOscillator(r),this._oscillator.type=t.substr(2)):"am"===t.substr(0,2)?(this._createNewOscillator(l),this._oscillator.type=t.substr(2)):"fat"===t.substr(0,3)?(this._createNewOscillator(u),this._oscillator.type=t.substr(3)):"pwm"===t?this._createNewOscillator(o):"pulse"===t?this._createNewOscillator(n):(this._createNewOscillator(a),this._oscillator.type=t)}}),Object.defineProperty(s.default.OmniOscillator.prototype,"partials",{get:function(){return this._oscillator.partials},set:function(t){this._oscillator.partials=t}}),Object.defineProperty(s.default.OmniOscillator.prototype,"partialCount",{get:function(){return this._oscillator.partialCount},set:function(t){this._oscillator.partialCount=t}}),s.default.OmniOscillator.prototype.set=function(t,e){return"type"===t?this.type=e:s.default.isObject(t)&&t.hasOwnProperty("type")&&(this.type=t.type),s.default.prototype.set.apply(this,arguments),this},s.default.OmniOscillator.prototype.get=function(t){var e=this._oscillator.get(t);return e.type=this.type,e},s.default.OmniOscillator.prototype._createNewOscillator=function(t){if(t!==this._sourceType){this._sourceType=t;var e=s.default[t],i=this.now();if(null!==this._oscillator){var n=this._oscillator;n.stop(i),this.context.setTimeout(function(){n.dispose(),n=null},this.blockTime)}this._oscillator=new e,this.frequency.connect(this._oscillator.frequency),this.detune.connect(this._oscillator.detune),this._oscillator.connect(this.output),this.state===s.default.State.Started&&this._oscillator.start(i)}},Object.defineProperty(s.default.OmniOscillator.prototype,"phase",{get:function(){return this._oscillator.phase},set:function(t){this._oscillator.phase=t}});var d={PulseOscillator:"pulse",PWMOscillator:"pwm",Oscillator:"oscillator",FMOscillator:"fm",AMOscillator:"am",FatOscillator:"fat"};Object.defineProperty(s.default.OmniOscillator.prototype,"sourceType",{get:function(){return d[this._sourceType]},set:function(t){var e="sine";"pwm"!==this._oscillator.type&&"pulse"!==this._oscillator.type&&(e=this._oscillator.type),t===d.FMOscillator?this.type="fm"+e:t===d.AMOscillator?this.type="am"+e:t===d.FatOscillator?this.type="fat"+e:t===d.Oscillator?this.type=e:t===d.PulseOscillator?this.type="pulse":t===d.PWMOscillator&&(this.type="pwm")}}),Object.defineProperty(s.default.OmniOscillator.prototype,"baseType",{get:function(){return this._oscillator.baseType},set:function(t){this.sourceType!==d.PulseOscillator&&this.sourceType!==d.PWMOscillator&&(this._oscillator.baseType=t)}}),Object.defineProperty(s.default.OmniOscillator.prototype,"width",{get:function(){return this._sourceType===n?this._oscillator.width:void 0}}),Object.defineProperty(s.default.OmniOscillator.prototype,"count",{get:function(){return this._sourceType===u?this._oscillator.count:void 0},set:function(t){this._sourceType===u&&(this._oscillator.count=t)}}),Object.defineProperty(s.default.OmniOscillator.prototype,"spread",{get:function(){return this._sourceType===u?this._oscillator.spread:void 0},set:function(t){this._sourceType===u&&(this._oscillator.spread=t)}}),Object.defineProperty(s.default.OmniOscillator.prototype,"modulationType",{get:function(){return this._sourceType===r||this._sourceType===l?this._oscillator.modulationType:void 0},set:function(t){this._sourceType!==r&&this._sourceType!==l||(this._oscillator.modulationType=t)}}),Object.defineProperty(s.default.OmniOscillator.prototype,"modulationIndex",{get:function(){return this._sourceType===r?this._oscillator.modulationIndex:void 0}}),Object.defineProperty(s.default.OmniOscillator.prototype,"harmonicity",{get:function(){return this._sourceType===r||this._sourceType===l?this._oscillator.harmonicity:void 0}}),Object.defineProperty(s.default.OmniOscillator.prototype,"modulationFrequency",{get:function(){return this._sourceType===o?this._oscillator.modulationFrequency:void 0}}),s.default.OmniOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._writable(["frequency","detune"]),this.detune.dispose(),this.detune=null,this.frequency.dispose(),this.frequency=null,this._oscillator.dispose(),this._oscillator=null,this._sourceType=null,this},e.default=s.default.OmniOscillator},function(t,e,i){"use strict";i.r(e);var s=i(0);i(31),i(37),i(25);s.default.Synth=function(t){t=s.default.defaultArg(t,s.default.Synth.defaults),s.default.Monophonic.call(this,t),this.oscillator=new s.default.OmniOscillator(t.oscillator),this.frequency=this.oscillator.frequency,this.detune=this.oscillator.detune,this.envelope=new s.default.AmplitudeEnvelope(t.envelope),this.oscillator.chain(this.envelope,this.output),this._readOnly(["oscillator","frequency","detune","envelope"])},s.default.extend(s.default.Synth,s.default.Monophonic),s.default.Synth.defaults={oscillator:{type:"triangle"},envelope:{attack:.005,decay:.1,sustain:.3,release:1}},s.default.Synth.prototype._triggerEnvelopeAttack=function(t,e){return this.envelope.triggerAttack(t,e),this.oscillator.start(t),0===this.envelope.sustain&&this.oscillator.stop(t+this.toSeconds(this.envelope.attack)+this.toSeconds(this.envelope.decay)),this},s.default.Synth.prototype._triggerEnvelopeRelease=function(t){return t=this.toSeconds(t),this.envelope.triggerRelease(t),this.oscillator.stop(t+this.toSeconds(this.envelope.release)),this},s.default.Synth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["oscillator","frequency","detune","envelope"]),this.oscillator.dispose(),this.oscillator=null,this.envelope.dispose(),this.envelope=null,this.frequency=null,this.detune=null,this},e.default=s.default.Synth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(6),i(11),i(32);s.default.Noise=function(){var t=s.default.defaults(arguments,["type"],s.default.Noise);s.default.Source.call(this,t),this._source=null,this._type=t.type,this._playbackRate=t.playbackRate},s.default.extend(s.default.Noise,s.default.Source),s.default.Noise.defaults={type:"white",playbackRate:1},Object.defineProperty(s.default.Noise.prototype,"type",{get:function(){return this._type},set:function(t){if(this._type!==t){if(!(t in n))throw new TypeError("Tone.Noise: invalid type: "+t);if(this._type=t,this.state===s.default.State.Started){var e=this.now();this._stop(e),this._start(e)}}}}),Object.defineProperty(s.default.Noise.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t,this._source&&(this._source.playbackRate.value=t)}}),s.default.Noise.prototype._start=function(t){var e=n[this._type];this._source=new s.default.BufferSource(e).connect(this.output),this._source.loop=!0,this._source.playbackRate.value=this._playbackRate,this._source.start(this.toSeconds(t),Math.random()*(e.duration-.001))},s.default.Noise.prototype._stop=function(t){this._source&&(this._source.stop(this.toSeconds(t)),this._source=null)},s.default.Noise.prototype.restart=function(t){return this._stop(t),this._start(t),this},s.default.Noise.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),null!==this._source&&(this._source.disconnect(),this._source=null),this._buffer=null,this};var n={},o={};Object.defineProperty(n,"pink",{get:function(){if(!o.pink){for(var t=[],e=0;e<2;e++){var i,n,a,r,l,u,d,f=new Float32Array(220500);t[e]=f,i=n=a=r=l=u=d=0;for(var h=0;h<220500;h++){var c=2*Math.random()-1;i=.99886*i+.0555179*c,n=.99332*n+.0750759*c,a=.969*a+.153852*c,r=.8665*r+.3104856*c,l=.55*l+.5329522*c,u=-.7616*u-.016898*c,f[h]=i+n+a+r+l+u+d+.5362*c,f[h]*=.11,d=.115926*c}}o.pink=(new s.default.Buffer).fromArray(t)}return o.pink}}),Object.defineProperty(n,"brown",{get:function(){if(!o.brown){for(var t=[],e=0;e<2;e++){var i=new Float32Array(220500);t[e]=i;for(var n=0,a=0;a<220500;a++){var r=2*Math.random()-1;i[a]=(n+.02*r)/1.02,n=i[a],i[a]*=3.5}}o.brown=(new s.default.Buffer).fromArray(t)}return o.brown}}),Object.defineProperty(n,"white",{get:function(){if(!o.white){for(var t=[],e=0;e<2;e++){var i=new Float32Array(220500);t[e]=i;for(var n=0;n<220500;n++)i[n]=2*Math.random()-1}o.white=(new s.default.Buffer).fromArray(t)}return o.white}}),e.default=s.default.Noise},function(t,e,i){"use strict";i.r(e);var s=i(0);i(27),i(20),i(1);s.default.Master=function(){s.default.AudioNode.call(this),s.default.getContext(function(){this.createInsOuts(1,0),this._volume=this.output=new s.default.Volume,this.volume=this._volume.volume,this._readOnly("volume"),s.default.connectSeries(this.input,this.output,this.context.destination),this.context.master=this}.bind(this))},s.default.extend(s.default.Master,s.default.AudioNode),s.default.Master.defaults={volume:0,mute:!1},s.default.Master.prototype.isMaster=!0,Object.defineProperty(s.default.Master.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t}}),s.default.Master.prototype.chain=function(){this.input.disconnect();var t=Array.from(arguments);t.unshift(this.input),t.push(this.output),s.default.connectSeries.apply(void 0,t)},s.default.Master.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._writable("volume"),this._volume.dispose(),this._volume=null,this.volume=null},s.default.AudioNode.prototype.toMaster=function(){return this.connect(this.context.master),this};var n=s.default.Master;s.default.Master=new n,s.default.Context.on("init",function(t){t.master&&t.master.isMaster?s.default.Master=t.master:s.default.Master=new n}),s.default.Context.on("close",function(t){t.master&&t.master.isMaster&&t.master.dispose()}),e.default=s.default.Master},function(t,e,i){"use strict";i.r(e);var s=i(0);i(86),i(47);s.default.FrequencyEnvelope=function(){var t=s.default.defaults(arguments,["attack","decay","sustain","release"],s.default.Envelope);t=s.default.defaultArg(t,s.default.FrequencyEnvelope.defaults),s.default.ScaledEnvelope.call(this,t),this._octaves=t.octaves,this.baseFrequency=t.baseFrequency,this.octaves=t.octaves,this.exponent=t.exponent},s.default.extend(s.default.FrequencyEnvelope,s.default.Envelope),s.default.FrequencyEnvelope.defaults={baseFrequency:200,octaves:4,exponent:1},Object.defineProperty(s.default.FrequencyEnvelope.prototype,"baseFrequency",{get:function(){return this._scale.min},set:function(t){this._scale.min=this.toFrequency(t),this.octaves=this._octaves}}),Object.defineProperty(s.default.FrequencyEnvelope.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t,this._scale.max=this.baseFrequency*Math.pow(2,t)}}),Object.defineProperty(s.default.FrequencyEnvelope.prototype,"exponent",{get:function(){return this._exp.value},set:function(t){this._exp.value=t}}),s.default.FrequencyEnvelope.prototype.dispose=function(){return s.default.ScaledEnvelope.prototype.dispose.call(this),this},e.default=s.default.FrequencyEnvelope},function(t,e,i){"use strict";i.r(e);var s=i(0);i(26),i(61);s.default.ScaleExp=function(t,e,i){s.default.SignalBase.call(this),this._scale=this.output=new s.default.Scale(t,e),this._exp=this.input=new s.default.Pow(s.default.defaultArg(i,2)),this._exp.connect(this._scale)},s.default.extend(s.default.ScaleExp,s.default.SignalBase),Object.defineProperty(s.default.ScaleExp.prototype,"exponent",{get:function(){return this._exp.value},set:function(t){this._exp.value=t}}),Object.defineProperty(s.default.ScaleExp.prototype,"min",{get:function(){return this._scale.min},set:function(t){this._scale.min=t}}),Object.defineProperty(s.default.ScaleExp.prototype,"max",{get:function(){return this._scale.max},set:function(t){this._scale.max=t}}),s.default.ScaleExp.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._scale.dispose(),this._scale=null,this._exp.dispose(),this._exp=null,this},e.default=s.default.ScaleExp},function(t,e,i){"use strict";i.r(e);var s=i(0);i(14),i(1);s.default.Compressor=function(){var t=s.default.defaults(arguments,["threshold","ratio"],s.default.Compressor);s.default.AudioNode.call(this),this._compressor=this.input=this.output=this.context.createDynamicsCompressor(),this.threshold=new s.default.Param({param:this._compressor.threshold,units:s.default.Type.Decibels,convert:!1}),this.attack=new s.default.Param(this._compressor.attack,s.default.Type.Time),this.release=new s.default.Param(this._compressor.release,s.default.Type.Time),this.knee=new s.default.Param({param:this._compressor.knee,units:s.default.Type.Decibels,convert:!1}),this.ratio=new s.default.Param({param:this._compressor.ratio,convert:!1}),this._readOnly(["knee","release","attack","ratio","threshold"]),this.set(t)},s.default.extend(s.default.Compressor,s.default.AudioNode),s.default.Compressor.defaults={ratio:12,threshold:-24,release:.25,attack:.003,knee:30},s.default.Compressor.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["knee","release","attack","ratio","threshold"]),this._compressor.disconnect(),this._compressor=null,this.attack.dispose(),this.attack=null,this.release.dispose(),this.release=null,this.threshold.dispose(),this.threshold=null,this.ratio.dispose(),this.ratio=null,this.knee.dispose(),this.knee=null,this},e.default=s.default.Compressor},function(t,e,i){"use strict";var s=i(0);i(92);if(s.default.supported){!s.default.global.hasOwnProperty("AudioContext")&&s.default.global.hasOwnProperty("webkitAudioContext")&&(s.default.global.AudioContext=s.default.global.webkitAudioContext),AudioContext.prototype.close||(AudioContext.prototype.close=function(){return s.default.isFunction(this.suspend)&&this.suspend(),Promise.resolve()}),AudioContext.prototype.resume||(AudioContext.prototype.resume=function(){var t=this.createBuffer(1,1,this.sampleRate),e=this.createBufferSource();return e.buffer=t,e.connect(this.destination),e.start(0),Promise.resolve()}),!AudioContext.prototype.createGain&&AudioContext.prototype.createGainNode&&(AudioContext.prototype.createGain=AudioContext.prototype.createGainNode),!AudioContext.prototype.createDelay&&AudioContext.prototype.createDelayNode&&(AudioContext.prototype.createDelay=AudioContext.prototype.createDelayNode);var n=!1,o=new OfflineAudioContext(1,1,44100),a=new Uint32Array([1179011410,48,1163280727,544501094,16,131073,44100,176400,1048580,1635017060,8,0,0,0,0]).buffer;try{var r=o.decodeAudioData(a);r&&s.default.isFunction(r.then)&&(n=!0)}catch(t){n=!1}n||(AudioContext.prototype._native_decodeAudioData=AudioContext.prototype.decodeAudioData,AudioContext.prototype.decodeAudioData=function(t){return new Promise(function(e,i){this._native_decodeAudioData(t,e,i)}.bind(this))})}},function(t,e,i){"use strict";i.r(e);var s=i(0);i(63);s.default.TransportTime=function(t,e){if(!(this instanceof s.default.TransportTime))return new s.default.TransportTime(t,e);s.default.Time.call(this,t,e)},s.default.extend(s.default.TransportTime,s.default.Time),s.default.TransportTime.prototype._now=function(){return s.default.Transport.seconds},e.default=s.default.TransportTime},function(t,e,i){"use strict";i.r(e);var s=i(0);i(62);s.default.Frequency=function(t,e){if(!(this instanceof s.default.Frequency))return new s.default.Frequency(t,e);s.default.TimeBase.call(this,t,e)},s.default.extend(s.default.Frequency,s.default.TimeBase),s.default.Frequency.prototype._expressions=Object.assign({},s.default.TimeBase.prototype._expressions,{midi:{regexp:/^(\d+(?:\.\d+)?midi)/,method:function(t){return"midi"===this._defaultUnits?t:s.default.Frequency.mtof(t)}},note:{regexp:/^([a-g]{1}(?:b|#|x|bb)?)(-?[0-9]+)/i,method:function(t,e){var i=n[t.toLowerCase()]+12*(parseInt(e)+1);return"midi"===this._defaultUnits?i:s.default.Frequency.mtof(i)}},tr:{regexp:/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):?(\d+(?:\.\d+)?)?/,method:function(t,e,i){var s=1;return t&&"0"!==t&&(s*=this._beatsToUnits(this._getTimeSignature()*parseFloat(t))),e&&"0"!==e&&(s*=this._beatsToUnits(parseFloat(e))),i&&"0"!==i&&(s*=this._beatsToUnits(parseFloat(i)/4)),s}}}),s.default.Frequency.prototype.transpose=function(t){return new this.constructor(this.valueOf()*s.default.intervalToFrequencyRatio(t))},s.default.Frequency.prototype.harmonize=function(t){return t.map(function(t){return this.transpose(t)}.bind(this))},s.default.Frequency.prototype.toMidi=function(){return s.default.Frequency.ftom(this.valueOf())},s.default.Frequency.prototype.toNote=function(){var t=this.toFrequency(),e=Math.log2(t/s.default.Frequency.A4),i=Math.round(12*e)+57,n=Math.floor(i/12);return n<0&&(i+=-12*n),o[i%12]+n.toString()},s.default.Frequency.prototype.toSeconds=function(){return 1/s.default.TimeBase.prototype.toSeconds.call(this)},s.default.Frequency.prototype.toFrequency=function(){return s.default.TimeBase.prototype.toFrequency.call(this)},s.default.Frequency.prototype.toTicks=function(){var t=this._beatsToUnits(1),e=this.valueOf()/t;return Math.floor(e*s.default.Transport.PPQ)},s.default.Frequency.prototype._noArg=function(){return 0},s.default.Frequency.prototype._frequencyToUnits=function(t){return t},s.default.Frequency.prototype._ticksToUnits=function(t){return 1/(60*t/(s.default.Transport.bpm.value*s.default.Transport.PPQ))},s.default.Frequency.prototype._beatsToUnits=function(t){return 1/s.default.TimeBase.prototype._beatsToUnits.call(this,t)},s.default.Frequency.prototype._secondsToUnits=function(t){return 1/t},s.default.Frequency.prototype._defaultUnits="hz";var n={cbb:-2,cb:-1,c:0,"c#":1,cx:2,dbb:0,db:1,d:2,"d#":3,dx:4,ebb:2,eb:3,e:4,"e#":5,ex:6,fbb:3,fb:4,f:5,"f#":6,fx:7,gbb:5,gb:6,g:7,"g#":8,gx:9,abb:7,ab:8,a:9,"a#":10,ax:11,bbb:9,bb:10,b:11,"b#":12,bx:13},o=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];s.default.Frequency.A4=440,s.default.Frequency.mtof=function(t){return s.default.Frequency.A4*Math.pow(2,(t-69)/12)},s.default.Frequency.ftom=function(t){return 69+Math.round(12*Math.log2(t/s.default.Frequency.A4))},e.default=s.default.Frequency},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(61),i(4),i(1);s.default.Envelope=function(){var t=s.default.defaults(arguments,["attack","decay","sustain","release"],s.default.Envelope);s.default.AudioNode.call(this),this.attack=t.attack,this.decay=t.decay,this.sustain=t.sustain,this.release=t.release,this._attackCurve="linear",this._releaseCurve="exponential",this._sig=this.output=new s.default.Signal(0),this.attackCurve=t.attackCurve,this.releaseCurve=t.releaseCurve,this.decayCurve=t.decayCurve},s.default.extend(s.default.Envelope,s.default.AudioNode),s.default.Envelope.defaults={attack:.01,decay:.1,sustain:.5,release:1,attackCurve:"linear",decayCurve:"exponential",releaseCurve:"exponential"},Object.defineProperty(s.default.Envelope.prototype,"value",{get:function(){return this.getValueAtTime(this.now())}}),s.default.Envelope.prototype._getCurve=function(t,e){if(s.default.isString(t))return t;if(s.default.isArray(t))for(var i in s.default.Envelope.Type)if(s.default.Envelope.Type[i][e]===t)return i},s.default.Envelope.prototype._setCurve=function(t,e,i){if(s.default.Envelope.Type.hasOwnProperty(i)){var n=s.default.Envelope.Type[i];s.default.isObject(n)?this[t]=n[e]:this[t]=n}else{if(!s.default.isArray(i))throw new Error("Tone.Envelope: invalid curve: "+i);this[t]=i}},Object.defineProperty(s.default.Envelope.prototype,"attackCurve",{get:function(){return this._getCurve(this._attackCurve,"In")},set:function(t){this._setCurve("_attackCurve","In",t)}}),Object.defineProperty(s.default.Envelope.prototype,"releaseCurve",{get:function(){return this._getCurve(this._releaseCurve,"Out")},set:function(t){this._setCurve("_releaseCurve","Out",t)}}),Object.defineProperty(s.default.Envelope.prototype,"decayCurve",{get:function(){return this._decayCurve},set:function(t){if(!["linear","exponential"].includes(t))throw new Error("Tone.Envelope: invalid curve: "+t);this._decayCurve=t}}),s.default.Envelope.prototype.triggerAttack=function(t,e){this.log("triggerAttack",t,e),t=this.toSeconds(t);var i=this.toSeconds(this.attack),n=this.toSeconds(this.decay);e=s.default.defaultArg(e,1);var o=this.getValueAtTime(t);o>0&&(i=(1-o)/(1/i));if(0===i)this._sig.setValueAtTime(e,t);else if("linear"===this._attackCurve)this._sig.linearRampTo(e,i,t);else if("exponential"===this._attackCurve)this._sig.targetRampTo(e,i,t);else if(i>0){this._sig.cancelAndHoldAtTime(t);for(var a=this._attackCurve,r=1;r<a.length;r++)if(a[r-1]<=o&&o<=a[r]){(a=this._attackCurve.slice(r))[0]=o;break}this._sig.setValueCurveAtTime(a,t,i,e)}if(n){var l=e*this.sustain,u=t+i;this.log("decay",u),"linear"===this._decayCurve?this._sig.linearRampTo(l,n,u+this.sampleTime):"exponential"===this._decayCurve&&this._sig.exponentialApproachValueAtTime(l,u,n)}return this},s.default.Envelope.prototype.triggerRelease=function(t){this.log("triggerRelease",t),t=this.toSeconds(t);var e=this.getValueAtTime(t);if(e>0){var i=this.toSeconds(this.release);if("linear"===this._releaseCurve)this._sig.linearRampTo(0,i,t);else if("exponential"===this._releaseCurve)this._sig.targetRampTo(0,i,t);else{var n=this._releaseCurve;s.default.isArray(n)&&(this._sig.cancelAndHoldAtTime(t),this._sig.setValueCurveAtTime(n,t,i,e))}}return this},s.default.Envelope.prototype.getValueAtTime=function(t){return this._sig.getValueAtTime(t)},s.default.Envelope.prototype.triggerAttackRelease=function(t,e,i){return e=this.toSeconds(e),this.triggerAttack(e,i),this.triggerRelease(e+this.toSeconds(t)),this},s.default.Envelope.prototype.cancel=function(t){return this._sig.cancelScheduledValues(t),this},s.default.Envelope.prototype.connect=s.default.SignalBase.prototype.connect,function(){var t,e,i=[];for(t=0;t<128;t++)i[t]=Math.sin(t/127*(Math.PI/2));var n=[];for(t=0;t<127;t++){e=t/127;var o=Math.sin(e*(2*Math.PI)*6.4-Math.PI/2)+1;n[t]=o/10+.83*e}n[127]=1;var a=[];for(t=0;t<128;t++)a[t]=Math.ceil(t/127*5)/5;var r=[];for(t=0;t<128;t++)e=t/127,r[t]=.5*(1-Math.cos(Math.PI*e));var l,u=[];for(t=0;t<128;t++){e=t/127;var d=4*Math.pow(e,3)+.2,f=Math.cos(d*Math.PI*2*e);u[t]=Math.abs(f*(1-e))}function h(t){for(var e=new Array(t.length),i=0;i<t.length;i++)e[i]=1-t[i];return e}s.default.Envelope.Type={linear:"linear",exponential:"exponential",bounce:{In:h(u),Out:u},cosine:{In:i,Out:(l=i,l.slice(0).reverse())},step:{In:a,Out:h(a)},ripple:{In:n,Out:h(n)},sine:{In:r,Out:h(r)}}}(),s.default.Envelope.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._sig.dispose(),this._sig=null,this._attackCurve=null,this._releaseCurve=null,this},e.default=s.default.Envelope},function(t,e,i){"use strict";i.r(e);var s=i(0);i(23),i(10),i(19),i(7),i(28),i(3),i(2),i(20);if(s.default.supported&&!s.default.global.AudioContext.prototype.createStereoPanner){var n=function(t){this.context=t,this.pan=new s.default.Signal(0,s.default.Type.AudioRange);var e=new s.default.WaveShaper(function(t){return s.default.equalPowerScale((t+1)/2)},4096),i=new s.default.WaveShaper(function(t){return s.default.equalPowerScale(1-(t+1)/2)},4096),n=new s.default.Gain,o=new s.default.Gain,a=this.input=new s.default.Split;a._splitter.channelCountMode="explicit",(new s.default.Zero).fan(e,i);var r=this.output=new s.default.Merge;a.left.chain(n,r.left),a.right.chain(o,r.right),this.pan.chain(i,n.gain),this.pan.chain(e,o.gain)};n.prototype.disconnect=function(){this.output.disconnect.apply(this.output,arguments)},n.prototype.connect=function(){this.output.connect.apply(this.output,arguments)},AudioContext.prototype.createStereoPanner=function(){return new n(this)},s.default.Context.prototype.createStereoPanner=function(){return new n(this)}}i(22),i(1);s.default.Panner=function(){var t=s.default.defaults(arguments,["pan"],s.default.Panner);s.default.AudioNode.call(this),this._panner=this.input=this.output=this.context.createStereoPanner(),this.pan=this._panner.pan,this.pan.value=t.pan,this._readOnly("pan")},s.default.extend(s.default.Panner,s.default.AudioNode),s.default.Panner.defaults={pan:0},s.default.Panner.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable("pan"),this._panner.disconnect(),this._panner=null,this.pan=null,this};e.default=s.default.Panner},function(t,e,i){"use strict";i.r(e);var s=i(0);i(6),i(17),i(5),i(3);s.default.FMOscillator=function(){var t=s.default.defaults(arguments,["frequency","type","modulationType"],s.default.FMOscillator);s.default.Source.call(this,t),this._carrier=new s.default.Oscillator(t.frequency,t.type),this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=this._carrier.detune,this.detune.value=t.detune,this.modulationIndex=new s.default.Multiply(t.modulationIndex),this.modulationIndex.units=s.default.Type.Positive,this._modulator=new s.default.Oscillator(t.frequency,t.modulationType),this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this._modulationNode=new s.default.Gain(0),this.frequency.connect(this._carrier.frequency),this.frequency.chain(this.harmonicity,this._modulator.frequency),this.frequency.chain(this.modulationIndex,this._modulationNode),this._modulator.connect(this._modulationNode.gain),this._modulationNode.connect(this._carrier.frequency),this._carrier.connect(this.output),this.detune.connect(this._modulator.detune),this.phase=t.phase,this._readOnly(["modulationIndex","frequency","detune","harmonicity"])},s.default.extend(s.default.FMOscillator,s.default.Source),s.default.FMOscillator.defaults={frequency:440,detune:0,phase:0,type:"sine",modulationIndex:2,modulationType:"square",harmonicity:1},s.default.FMOscillator.prototype._start=function(t){this._modulator.start(t),this._carrier.start(t)},s.default.FMOscillator.prototype._stop=function(t){this._modulator.stop(t),this._carrier.stop(t)},s.default.FMOscillator.prototype.restart=function(t){this._modulator.restart(t),this._carrier.restart(t)},Object.defineProperty(s.default.FMOscillator.prototype,"type",{get:function(){return this._carrier.type},set:function(t){this._carrier.type=t}}),Object.defineProperty(s.default.FMOscillator.prototype,"baseType",{get:function(){return this._carrier.baseType},set:function(t){this._carrier.baseType=t}}),Object.defineProperty(s.default.FMOscillator.prototype,"partialCount",{get:function(){return this._carrier.partialCount},set:function(t){this._carrier.partialCount=t}}),Object.defineProperty(s.default.FMOscillator.prototype,"modulationType",{get:function(){return this._modulator.type},set:function(t){this._modulator.type=t}}),Object.defineProperty(s.default.FMOscillator.prototype,"phase",{get:function(){return this._carrier.phase},set:function(t){this._carrier.phase=t,this._modulator.phase=t}}),Object.defineProperty(s.default.FMOscillator.prototype,"partials",{get:function(){return this._carrier.partials},set:function(t){this._carrier.partials=t}}),s.default.FMOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._writable(["modulationIndex","frequency","detune","harmonicity"]),this.frequency.dispose(),this.frequency=null,this.detune=null,this.harmonicity.dispose(),this.harmonicity=null,this._carrier.dispose(),this._carrier=null,this._modulator.dispose(),this._modulator=null,this._modulationNode.dispose(),this._modulationNode=null,this.modulationIndex.dispose(),this.modulationIndex=null,this},e.default=s.default.FMOscillator},function(t,e,i){"use strict";i.r(e);var s=i(0);i(6),i(17),i(2),i(7),i(3);s.default.PulseOscillator=function(){var t=s.default.defaults(arguments,["frequency","width"],s.default.Oscillator);s.default.Source.call(this,t),this.width=new s.default.Signal(t.width,s.default.Type.NormalRange),this._widthGate=new s.default.Gain(0),this._sawtooth=new s.default.Oscillator({frequency:t.frequency,detune:t.detune,type:"sawtooth",phase:t.phase}),this.frequency=this._sawtooth.frequency,this.detune=this._sawtooth.detune,this._thresh=new s.default.WaveShaper(function(t){return t<0?-1:1}),this._sawtooth.chain(this._thresh,this.output),this.width.chain(this._widthGate,this._thresh),this._readOnly(["width","frequency","detune"])},s.default.extend(s.default.PulseOscillator,s.default.Source),s.default.PulseOscillator.defaults={frequency:440,detune:0,phase:0,width:.2},s.default.PulseOscillator.prototype._start=function(t){t=this.toSeconds(t),this._sawtooth.start(t),this._widthGate.gain.setValueAtTime(1,t)},s.default.PulseOscillator.prototype._stop=function(t){t=this.toSeconds(t),this._sawtooth.stop(t),this._widthGate.gain.setValueAtTime(0,t)},s.default.PulseOscillator.prototype.restart=function(t){this._sawtooth.restart(t),this._widthGate.gain.cancelScheduledValues(t),this._widthGate.gain.setValueAtTime(1,t)},Object.defineProperty(s.default.PulseOscillator.prototype,"phase",{get:function(){return this._sawtooth.phase},set:function(t){this._sawtooth.phase=t}}),Object.defineProperty(s.default.PulseOscillator.prototype,"type",{get:function(){return"pulse"}}),Object.defineProperty(s.default.PulseOscillator.prototype,"baseType",{get:function(){return"pulse"}}),Object.defineProperty(s.default.PulseOscillator.prototype,"partials",{get:function(){return[]}}),s.default.PulseOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._sawtooth.dispose(),this._sawtooth=null,this._writable(["width","frequency","detune"]),this.width.dispose(),this.width=null,this._widthGate.dispose(),this._widthGate=null,this._thresh.dispose(),this._thresh=null,this.frequency=null,this.detune=null,this},e.default=s.default.PulseOscillator},function(t,e,i){"use strict";i.r(e);var s=i(0);i(16),i(4),i(34);s.default.Event=function(){var t=s.default.defaults(arguments,["callback","value"],s.default.Event);s.default.call(this),this._loop=t.loop,this.callback=t.callback,this.value=t.value,this._loopStart=this.toTicks(t.loopStart),this._loopEnd=this.toTicks(t.loopEnd),this._state=new s.default.TimelineState(s.default.State.Stopped),this._playbackRate=1,this._startOffset=0,this._probability=t.probability,this._humanize=t.humanize,this.mute=t.mute,this.playbackRate=t.playbackRate},s.default.extend(s.default.Event),s.default.Event.defaults={callback:s.default.noOp,loop:!1,loopEnd:"1m",loopStart:0,playbackRate:1,value:null,probability:1,mute:!1,humanize:!1},s.default.Event.prototype._rescheduleEvents=function(t){return t=s.default.defaultArg(t,-1),this._state.forEachFrom(t,function(t){var e;if(t.state===s.default.State.Started){s.default.isDefined(t.id)&&s.default.Transport.clear(t.id);var i=t.time+Math.round(this.startOffset/this._playbackRate);if(!0===this._loop||s.default.isNumber(this._loop)&&this._loop>1){e=1/0,s.default.isNumber(this._loop)&&(e=this._loop*this._getLoopDuration());var n=this._state.getAfter(i);null!==n&&(e=Math.min(e,n.time-i)),e!==1/0&&(this._state.setStateAtTime(s.default.State.Stopped,i+e+1),e=s.default.Ticks(e));var o=s.default.Ticks(this._getLoopDuration());t.id=s.default.Transport.scheduleRepeat(this._tick.bind(this),o,s.default.Ticks(i),e)}else t.id=s.default.Transport.schedule(this._tick.bind(this),s.default.Ticks(i))}}.bind(this)),this},Object.defineProperty(s.default.Event.prototype,"state",{get:function(){return this._state.getValueAtTime(s.default.Transport.ticks)}}),Object.defineProperty(s.default.Event.prototype,"startOffset",{get:function(){return this._startOffset},set:function(t){this._startOffset=t}}),Object.defineProperty(s.default.Event.prototype,"probability",{get:function(){return this._probability},set:function(t){this._probability=t}}),Object.defineProperty(s.default.Event.prototype,"humanize",{get:function(){return this._humanize},set:function(t){this._humanize=t}}),s.default.Event.prototype.start=function(t){return t=this.toTicks(t),this._state.getValueAtTime(t)===s.default.State.Stopped&&(this._state.add({state:s.default.State.Started,time:t,id:void 0}),this._rescheduleEvents(t)),this},s.default.Event.prototype.stop=function(t){if(this.cancel(t),t=this.toTicks(t),this._state.getValueAtTime(t)===s.default.State.Started){this._state.setStateAtTime(s.default.State.Stopped,t);var e=this._state.getBefore(t),i=t;null!==e&&(i=e.time),this._rescheduleEvents(i)}return this},s.default.Event.prototype.cancel=function(t){return t=s.default.defaultArg(t,-1/0),t=this.toTicks(t),this._state.forEachFrom(t,function(t){s.default.Transport.clear(t.id)}),this._state.cancel(t),this},s.default.Event.prototype._tick=function(t){var e=s.default.Transport.getTicksAtTime(t);if(!this.mute&&this._state.getValueAtTime(e)===s.default.State.Started){if(this.probability<1&&Math.random()>this.probability)return;if(this.humanize){var i=.02;s.default.isBoolean(this.humanize)||(i=this.toSeconds(this.humanize)),t+=(2*Math.random()-1)*i}this.callback(t,this.value)}},s.default.Event.prototype._getLoopDuration=function(){return Math.round((this._loopEnd-this._loopStart)/this._playbackRate)},Object.defineProperty(s.default.Event.prototype,"loop",{get:function(){return this._loop},set:function(t){this._loop=t,this._rescheduleEvents()}}),Object.defineProperty(s.default.Event.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t,this._rescheduleEvents()}}),Object.defineProperty(s.default.Event.prototype,"loopEnd",{get:function(){return s.default.Ticks(this._loopEnd).toSeconds()},set:function(t){this._loopEnd=this.toTicks(t),this._loop&&this._rescheduleEvents()}}),Object.defineProperty(s.default.Event.prototype,"loopStart",{get:function(){return s.default.Ticks(this._loopStart).toSeconds()},set:function(t){this._loopStart=this.toTicks(t),this._loop&&this._rescheduleEvents()}}),Object.defineProperty(s.default.Event.prototype,"progress",{get:function(){if(this._loop){var t=s.default.Transport.ticks,e=this._state.get(t);if(null!==e&&e.state===s.default.State.Started){var i=this._getLoopDuration();return(t-e.time)%i/i}return 0}return 0}}),s.default.Event.prototype.dispose=function(){this.cancel(),this._state.dispose(),this._state=null,this.callback=null,this.value=null},e.default=s.default.Event},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(13),i(29),i(10),i(3),i(1);s.default.MidSideMerge=function(){s.default.AudioNode.call(this),this.createInsOuts(2,0),this.mid=this.input[0]=new s.default.Gain,this._left=new s.default.Add,this._timesTwoLeft=new s.default.Multiply(Math.SQRT1_2),this.side=this.input[1]=new s.default.Gain,this._right=new s.default.Subtract,this._timesTwoRight=new s.default.Multiply(Math.SQRT1_2),this._merge=this.output=new s.default.Merge,this.mid.connect(this._left,0,0),this.side.connect(this._left,0,1),this.mid.connect(this._right,0,0),this.side.connect(this._right,0,1),this._left.connect(this._timesTwoLeft),this._right.connect(this._timesTwoRight),this._timesTwoLeft.connect(this._merge,0,0),this._timesTwoRight.connect(this._merge,0,1)},s.default.extend(s.default.MidSideMerge,s.default.AudioNode),s.default.MidSideMerge.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this.mid.dispose(),this.mid=null,this.side.dispose(),this.side=null,this._left.dispose(),this._left=null,this._timesTwoLeft.dispose(),this._timesTwoLeft=null,this._right.dispose(),this._right=null,this._timesTwoRight.dispose(),this._timesTwoRight=null,this._merge.dispose(),this._merge=null,this},e.default=s.default.MidSideMerge},function(t,e,i){"use strict";i.r(e);var s=i(0);i(29),i(13),i(2),i(19),i(1);s.default.MidSideSplit=function(){s.default.AudioNode.call(this),this.createInsOuts(0,2),this._split=this.input=new s.default.Split,this._midAdd=new s.default.Add,this.mid=this.output[0]=new s.default.Multiply(Math.SQRT1_2),this._sideSubtract=new s.default.Subtract,this.side=this.output[1]=new s.default.Multiply(Math.SQRT1_2),this._split.connect(this._midAdd,0,0),this._split.connect(this._midAdd,1,1),this._split.connect(this._sideSubtract,0,0),this._split.connect(this._sideSubtract,1,1),this._midAdd.connect(this.mid),this._sideSubtract.connect(this.side)},s.default.extend(s.default.MidSideSplit,s.default.AudioNode),s.default.MidSideSplit.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this.mid.dispose(),this.mid=null,this.side.dispose(),this.side=null,this._midAdd.dispose(),this._midAdd=null,this._sideSubtract.dispose(),this._sideSubtract=null,this._split.dispose(),this._split=null,this},e.default=s.default.MidSideSplit},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(9),i(1),i(59);s.default.LowpassCombFilter=function(){var t=s.default.defaults(arguments,["delayTime","resonance","dampening"],s.default.LowpassCombFilter);s.default.AudioNode.call(this),this._combFilter=this.output=new s.default.FeedbackCombFilter(t.delayTime,t.resonance),this.delayTime=this._combFilter.delayTime,this._lowpass=this.input=new s.default.Filter({frequency:t.dampening,type:"lowpass",Q:0,rolloff:-12}),this.dampening=this._lowpass.frequency,this.resonance=this._combFilter.resonance,this._lowpass.connect(this._combFilter),this._readOnly(["dampening","resonance","delayTime"])},s.default.extend(s.default.LowpassCombFilter,s.default.AudioNode),s.default.LowpassCombFilter.defaults={delayTime:.1,resonance:.5,dampening:3e3},s.default.LowpassCombFilter.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["dampening","resonance","delayTime"]),this._combFilter.dispose(),this._combFilter=null,this.resonance=null,this.delayTime=null,this._lowpass.dispose(),this._lowpass=null,this.dampening=null,this},e.default=s.default.LowpassCombFilter},function(t,e,i){"use strict";i.r(e);var s=i(0);i(45);s.default.Ticks=function(t,e){if(!(this instanceof s.default.Ticks))return new s.default.Ticks(t,e);s.default.TransportTime.call(this,t,e)},s.default.extend(s.default.Ticks,s.default.TransportTime),s.default.Ticks.prototype._defaultUnits="i",s.default.Ticks.prototype._now=function(){return s.default.Transport.ticks},s.default.Ticks.prototype._beatsToUnits=function(t){return this._getPPQ()*t},s.default.Ticks.prototype._secondsToUnits=function(t){return Math.floor(t/(60/this._getBpm())*this._getPPQ())},s.default.Ticks.prototype._ticksToUnits=function(t){return t},s.default.Ticks.prototype.toTicks=function(){return this.valueOf()},s.default.Ticks.prototype.toSeconds=function(){return this.valueOf()/this._getPPQ()*(60/this._getBpm())},e.default=s.default.Ticks},function(t,e,i){"use strict";i.r(e);var s=i(0);i(55);s.default.TransportEvent=function(t,e){e=s.default.defaultArg(e,s.default.TransportEvent.defaults),s.default.call(this),this.Transport=t,this.id=s.default.TransportEvent._eventId++,this.time=s.default.Ticks(e.time),this.callback=e.callback,this._once=e.once},s.default.extend(s.default.TransportEvent),s.default.TransportEvent.defaults={once:!1,callback:s.default.noOp},s.default.TransportEvent._eventId=0,s.default.TransportEvent.prototype.invoke=function(t){this.callback&&(this.callback(t),this._once&&this.Transport&&this.Transport.clear(this.id))},s.default.TransportEvent.prototype.dispose=function(){return s.default.prototype.dispose.call(this),this.Transport=null,this.callback=null,this.time=null,this},e.default=s.default.TransportEvent},function(t,e,i){"use strict";i.r(e);var s=i(0);i(82),i(34),i(24),i(14);s.default.TickSource=function(){var t=s.default.defaults(arguments,["frequency"],s.default.TickSource);this.frequency=new s.default.TickSignal(t.frequency),this._readOnly("frequency"),this._state=new s.default.TimelineState(s.default.State.Stopped),this._state.setStateAtTime(s.default.State.Stopped,0),this._tickOffset=new s.default.Timeline,this.setTicksAtTime(0,0)},s.default.extend(s.default.TickSource),s.default.TickSource.defaults={frequency:1},Object.defineProperty(s.default.TickSource.prototype,"state",{get:function(){return this._state.getValueAtTime(this.now())}}),s.default.TickSource.prototype.start=function(t,e){return t=this.toSeconds(t),this._state.getValueAtTime(t)!==s.default.State.Started&&(this._state.setStateAtTime(s.default.State.Started,t),s.default.isDefined(e)&&this.setTicksAtTime(e,t)),this},s.default.TickSource.prototype.stop=function(t){if(t=this.toSeconds(t),this._state.getValueAtTime(t)===s.default.State.Stopped){var e=this._state.get(t);e.time>0&&(this._tickOffset.cancel(e.time),this._state.cancel(e.time))}return this._state.cancel(t),this._state.setStateAtTime(s.default.State.Stopped,t),this.setTicksAtTime(0,t),this},s.default.TickSource.prototype.pause=function(t){return t=this.toSeconds(t),this._state.getValueAtTime(t)===s.default.State.Started&&this._state.setStateAtTime(s.default.State.Paused,t),this},s.default.TickSource.prototype.cancel=function(t){return t=this.toSeconds(t),this._state.cancel(t),this._tickOffset.cancel(t),this},s.default.TickSource.prototype.getTicksAtTime=function(t){t=this.toSeconds(t);var e=this._state.getLastState(s.default.State.Stopped,t),i={state:s.default.State.Paused,time:t};this._state.add(i);var n=e,o=0;return this._state.forEachBetween(e.time,t+this.sampleTime,function(t){var e=n.time,i=this._tickOffset.get(t.time);i.time>=n.time&&(o=i.ticks,e=i.time),n.state===s.default.State.Started&&t.state!==s.default.State.Started&&(o+=this.frequency.getTicksAtTime(t.time)-this.frequency.getTicksAtTime(e)),n=t}.bind(this)),this._state.remove(i),o},Object.defineProperty(s.default.TickSource.prototype,"ticks",{get:function(){return this.getTicksAtTime(this.now())},set:function(t){this.setTicksAtTime(t,this.now())}}),Object.defineProperty(s.default.TickSource.prototype,"seconds",{get:function(){return this.getSecondsAtTime(this.now())},set:function(t){var e=this.now(),i=this.frequency.timeToTicks(t,e);this.setTicksAtTime(i,e)}}),s.default.TickSource.prototype.getSecondsAtTime=function(t){t=this.toSeconds(t);var e=this._state.getLastState(s.default.State.Stopped,t),i={state:s.default.State.Paused,time:t};this._state.add(i);var n=e,o=0;return this._state.forEachBetween(e.time,t+this.sampleTime,function(t){var e=n.time,i=this._tickOffset.get(t.time);i.time>=n.time&&(o=i.seconds,e=i.time),n.state===s.default.State.Started&&t.state!==s.default.State.Started&&(o+=t.time-e),n=t}.bind(this)),this._state.remove(i),o},s.default.TickSource.prototype.setTicksAtTime=function(t,e){return e=this.toSeconds(e),this._tickOffset.cancel(e),this._tickOffset.add({time:e,ticks:t,seconds:this.frequency.getDurationOfTicks(t,e)}),this},s.default.TickSource.prototype.getStateAtTime=function(t){return t=this.toSeconds(t),this._state.getValueAtTime(t)},s.default.TickSource.prototype.getTimeOfTick=function(t,e){e=s.default.defaultArg(e,this.now());var i=this._tickOffset.get(e),n=this._state.get(e),o=Math.max(i.time,n.time),a=this.frequency.getTicksAtTime(o)+t-i.ticks;return this.frequency.getTimeOfTick(a)},s.default.TickSource.prototype.forEachTickBetween=function(t,e,i){var n=this._state.get(t);if(this._state.forEachBetween(t,e,function(e){n.state===s.default.State.Started&&e.state!==s.default.State.Started&&this.forEachTickBetween(Math.max(n.time,t),e.time-this.sampleTime,i),n=e}.bind(this)),t=Math.max(n.time,t),n.state===s.default.State.Started&&this._state){var o=this.frequency.getTicksAtTime(t),a=(o-this.frequency.getTicksAtTime(n.time))%1;0!==a&&(a=1-a);for(var r=this.frequency.getTimeOfTick(o+a),l=null;r<e&&this._state;){try{i(r,Math.round(this.getTicksAtTime(r)))}catch(t){l=t;break}this._state&&(r+=this.frequency.getDurationOfTicks(1,r))}}if(l)throw l;return this},s.default.TickSource.prototype.dispose=function(){return s.default.Param.prototype.dispose.call(this),this._state.dispose(),this._state=null,this._tickOffset.dispose(),this._tickOffset=null,this._writable("frequency"),this.frequency.dispose(),this.frequency=null,this},e.default=s.default.TickSource},function(t,e,i){"use strict";i.r(e);var s=i(0);i(87),i(13),i(2),i(4),i(18),i(1);s.default.Follower=function(){var t=s.default.defaults(arguments,["smoothing"],s.default.Follower);s.default.AudioNode.call(this),this.createInsOuts(1,1),this._abs=new s.default.Abs,this._filter=this.context.createBiquadFilter(),this._filter.type="lowpass",this._filter.frequency.value=0,this._filter.Q.value=0,this._sub=new s.default.Subtract,this._delay=new s.default.Delay(this.blockTime),this._smoothing=t.smoothing,s.default.connect(this.input,this._delay),s.default.connect(this.input,this._sub,0,1),this._sub.chain(this._abs,this._filter,this.output),this.smoothing=t.smoothing},s.default.extend(s.default.Follower,s.default.AudioNode),s.default.Follower.defaults={smoothing:.05},Object.defineProperty(s.default.Follower.prototype,"smoothing",{get:function(){return this._smoothing},set:function(t){this._smoothing=t,this._filter.frequency.value=.5*s.default.Time(t).toFrequency()}}),s.default.Follower.prototype.connect=s.default.SignalBase.prototype.connect,s.default.Follower.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._filter.disconnect(),this._filter=null,this._delay.dispose(),this._delay=null,this._sub.disconnect(),this._sub=null,this._abs.dispose(),this._abs=null,this},e.default=s.default.Follower},function(t,e,i){"use strict";i.r(e);var s=i(0);i(42),i(2),i(14),i(18),i(3),i(1);s.default.FeedbackCombFilter=function(){var t=s.default.defaults(arguments,["delayTime","resonance"],s.default.FeedbackCombFilter);s.default.AudioNode.call(this),this._delay=this.input=this.output=new s.default.Delay(t.delayTime),this.delayTime=this._delay.delayTime,this._feedback=new s.default.Gain(t.resonance,s.default.Type.NormalRange),this.resonance=this._feedback.gain,this._delay.chain(this._feedback,this._delay),this._readOnly(["resonance","delayTime"])},s.default.extend(s.default.FeedbackCombFilter,s.default.AudioNode),s.default.FeedbackCombFilter.defaults={delayTime:.1,resonance:.5},s.default.FeedbackCombFilter.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["resonance","delayTime"]),this._delay.dispose(),this._delay=null,this.delayTime=null,this._feedback.dispose(),this._feedback=null,this.resonance=null,this},e.default=s.default.FeedbackCombFilter},function(t,e,i){"use strict";i.r(e);var s=i(0);i(9),i(2),i(3),i(1);s.default.MultibandSplit=function(){var t=s.default.defaults(arguments,["lowFrequency","highFrequency"],s.default.MultibandSplit);s.default.AudioNode.call(this),this.input=new s.default.Gain,this.output=new Array(3),this.low=this.output[0]=new s.default.Filter(0,"lowpass"),this._lowMidFilter=new s.default.Filter(0,"highpass"),this.mid=this.output[1]=new s.default.Filter(0,"lowpass"),this.high=this.output[2]=new s.default.Filter(0,"highpass"),this.lowFrequency=new s.default.Signal(t.lowFrequency,s.default.Type.Frequency),this.highFrequency=new s.default.Signal(t.highFrequency,s.default.Type.Frequency),this.Q=new s.default.Signal(t.Q),this.input.fan(this.low,this.high),this.input.chain(this._lowMidFilter,this.mid),this.lowFrequency.connect(this.low.frequency),this.lowFrequency.connect(this._lowMidFilter.frequency),this.highFrequency.connect(this.mid.frequency),this.highFrequency.connect(this.high.frequency),this.Q.connect(this.low.Q),this.Q.connect(this._lowMidFilter.Q),this.Q.connect(this.mid.Q),this.Q.connect(this.high.Q),this._readOnly(["high","mid","low","highFrequency","lowFrequency"])},s.default.extend(s.default.MultibandSplit,s.default.AudioNode),s.default.MultibandSplit.defaults={lowFrequency:400,highFrequency:2500,Q:1},s.default.MultibandSplit.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["high","mid","low","highFrequency","lowFrequency"]),this.low.dispose(),this.low=null,this._lowMidFilter.dispose(),this._lowMidFilter=null,this.mid.dispose(),this.mid=null,this.high.dispose(),this.high=null,this.lowFrequency.dispose(),this.lowFrequency=null,this.highFrequency.dispose(),this.highFrequency=null,this.Q.dispose(),this.Q=null,this},e.default=s.default.MultibandSplit},function(t,e,i){"use strict";i.r(e);var s=i(0);i(7);s.default.Pow=function(t){s.default.SignalBase.call(this),this._exp=s.default.defaultArg(t,1),this._expScaler=this.input=this.output=new s.default.WaveShaper(this._expFunc(this._exp),8192)},s.default.extend(s.default.Pow,s.default.SignalBase),Object.defineProperty(s.default.Pow.prototype,"value",{get:function(){return this._exp},set:function(t){this._exp=t,this._expScaler.setMap(this._expFunc(this._exp))}}),s.default.Pow.prototype._expFunc=function(t){return function(e){return Math.pow(Math.abs(e),t)}},s.default.Pow.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._expScaler.dispose(),this._expScaler=null,this},e.default=s.default.Pow},function(t,e,i){"use strict";i.r(e);var s=i(0);s.default.TimeBase=function(t,e){if(!(this instanceof s.default.TimeBase))return new s.default.TimeBase(t,e);if(this._val=t,this._units=e,s.default.isUndef(this._units)&&s.default.isString(this._val)&&parseFloat(this._val)==this._val&&"+"!==this._val.charAt(0))this._val=parseFloat(this._val),this._units=this._defaultUnits;else if(t&&t.constructor===this.constructor)this._val=t._val,this._units=t._units;else if(t instanceof s.default.TimeBase)switch(this._defaultUnits){case"s":this._val=t.toSeconds();break;case"i":this._val=t.toTicks();break;case"hz":this._val=t.toFrequency();break;case"midi":this._val=t.toMidi();break;default:throw new Error("Unrecognized default units "+this._defaultUnits)}},s.default.extend(s.default.TimeBase),s.default.TimeBase.prototype._expressions={n:{regexp:/^(\d+)n(\.?)$/i,method:function(t,e){t=parseInt(t);var i="."===e?1.5:1;return 1===t?this._beatsToUnits(this._getTimeSignature())*i:this._beatsToUnits(4/t)*i}},t:{regexp:/^(\d+)t$/i,method:function(t){return t=parseInt(t),this._beatsToUnits(8/(3*parseInt(t)))}},m:{regexp:/^(\d+)m$/i,method:function(t){return this._beatsToUnits(parseInt(t)*this._getTimeSignature())}},i:{regexp:/^(\d+)i$/i,method:function(t){return this._ticksToUnits(parseInt(t))}},hz:{regexp:/^(\d+(?:\.\d+)?)hz$/i,method:function(t){return this._frequencyToUnits(parseFloat(t))}},tr:{regexp:/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):?(\d+(?:\.\d+)?)?$/,method:function(t,e,i){var s=0;return t&&"0"!==t&&(s+=this._beatsToUnits(this._getTimeSignature()*parseFloat(t))),e&&"0"!==e&&(s+=this._beatsToUnits(parseFloat(e))),i&&"0"!==i&&(s+=this._beatsToUnits(parseFloat(i)/4)),s}},s:{regexp:/^(\d+(?:\.\d+)?)s$/,method:function(t){return this._secondsToUnits(parseFloat(t))}},samples:{regexp:/^(\d+)samples$/,method:function(t){return parseInt(t)/this.context.sampleRate}},default:{regexp:/^(\d+(?:\.\d+)?)$/,method:function(t){return this._expressions[this._defaultUnits].method.call(this,t)}}},s.default.TimeBase.prototype._defaultUnits="s",s.default.TimeBase.prototype._getBpm=function(){return s.default.Transport?s.default.Transport.bpm.value:120},s.default.TimeBase.prototype._getTimeSignature=function(){return s.default.Transport?s.default.Transport.timeSignature:4},s.default.TimeBase.prototype._getPPQ=function(){return s.default.Transport?s.default.Transport.PPQ:192},s.default.TimeBase.prototype._now=function(){return this.now()},s.default.TimeBase.prototype._frequencyToUnits=function(t){return 1/t},s.default.TimeBase.prototype._beatsToUnits=function(t){return 60/this._getBpm()*t},s.default.TimeBase.prototype._secondsToUnits=function(t){return t},s.default.TimeBase.prototype._ticksToUnits=function(t){return t*(this._beatsToUnits(1)/this._getPPQ())},s.default.TimeBase.prototype._noArg=function(){return this._now()},s.default.TimeBase.prototype.valueOf=function(){if(s.default.isUndef(this._val))return this._noArg();if(s.default.isString(this._val)&&s.default.isUndef(this._units)){for(var t in this._expressions)if(this._expressions[t].regexp.test(this._val.trim())){this._units=t;break}}else if(s.default.isObject(this._val)){var e=0;for(var i in this._val){var n=this._val[i];e+=new this.constructor(i).valueOf()*n}return e}if(s.default.isDefined(this._units)){var o=this._expressions[this._units],a=this._val.toString().trim().match(o.regexp);return a?o.method.apply(this,a.slice(1)):o.method.call(this,parseFloat(this._val))}return this._val},s.default.TimeBase.prototype.toSeconds=function(){return this.valueOf()},s.default.TimeBase.prototype.toFrequency=function(){return 1/this.toSeconds()},s.default.TimeBase.prototype.toSamples=function(){return this.toSeconds()*this.context.sampleRate},s.default.TimeBase.prototype.toMilliseconds=function(){return 1e3*this.toSeconds()},s.default.TimeBase.prototype.dispose=function(){this._val=null,this._units=null},e.default=s.default.TimeBase},function(t,e,i){"use strict";i.r(e);var s=i(0);i(62),i(46);s.default.Time=function(t,e){if(!(this instanceof s.default.Time))return new s.default.Time(t,e);s.default.TimeBase.call(this,t,e)},s.default.extend(s.default.Time,s.default.TimeBase),s.default.Time.prototype._expressions=Object.assign({},s.default.TimeBase.prototype._expressions,{quantize:{regexp:/^@(.+)/,method:function(t){if(s.default.Transport){var e=new this.constructor(t);return this._secondsToUnits(s.default.Transport.nextSubdivision(e))}return 0}},now:{regexp:/^\+(.+)/,method:function(t){return this._now()+new this.constructor(t)}}}),s.default.Time.prototype.quantize=function(t,e){e=s.default.defaultArg(e,1);var i=new this.constructor(t),n=this.valueOf();return n+(Math.round(n/i)*i-n)*e},s.default.Time.prototype.toNotation=function(){for(var t=this.toSeconds(),e=["1m"],i=1;i<8;i++){var n=Math.pow(2,i);e.push(n+"n."),e.push(n+"n"),e.push(n+"t")}e.push("0");var o=e[0],a=s.default.Time(e[0]).toSeconds();return e.forEach(function(e){var i=s.default.Time(e).toSeconds();Math.abs(i-t)<Math.abs(a-t)&&(o=e,a=i)}),o},s.default.Time.prototype.toBarsBeatsSixteenths=function(){var t=this._beatsToUnits(1),e=this.valueOf()/t;e=parseFloat(e.toFixed(4));var i=Math.floor(e/this._getTimeSignature()),s=e%1*4;return e=Math.floor(e)%this._getTimeSignature(),(s=s.toString()).length>3&&(s=parseFloat(parseFloat(s).toFixed(3))),[i,e,s].join(":")},s.default.Time.prototype.toTicks=function(){var t=this._beatsToUnits(1),e=this.valueOf()/t;return Math.round(e*this._getPPQ())},s.default.Time.prototype.toSeconds=function(){return this.valueOf()},s.default.Time.prototype.toMidi=function(){return s.default.Frequency.ftom(this.toFrequency())},e.default=s.default.Time},function(t,e,i){"use strict";i.r(e);var s=i(0);i(11),i(6),i(3),i(1);s.default.supported&&(OscillatorNode.prototype.setPeriodicWave||(OscillatorNode.prototype.setPeriodicWave=OscillatorNode.prototype.setWaveTable),AudioContext.prototype.createPeriodicWave||(AudioContext.prototype.createPeriodicWave=AudioContext.prototype.createWaveTable)),s.default.OscillatorNode=function(){var t=s.default.defaults(arguments,["frequency","type"],s.default.OscillatorNode);s.default.AudioNode.call(this,t),this.onended=t.onended,this._startTime=-1,this._stopTime=-1,this._gainNode=this.output=new s.default.Gain(0),this._oscillator=this.context.createOscillator(),s.default.connect(this._oscillator,this._gainNode),this.type=t.type,this.frequency=new s.default.Param({param:this._oscillator.frequency,units:s.default.Type.Frequency,value:t.frequency}),this.detune=new s.default.Param({param:this._oscillator.detune,units:s.default.Type.Cents,value:t.detune}),this._gain=1},s.default.extend(s.default.OscillatorNode,s.default.AudioNode),s.default.OscillatorNode.defaults={frequency:440,detune:0,type:"sine",onended:s.default.noOp},Object.defineProperty(s.default.OscillatorNode.prototype,"state",{get:function(){return this.getStateAtTime(this.now())}}),s.default.OscillatorNode.prototype.getStateAtTime=function(t){return t=this.toSeconds(t),-1!==this._startTime&&t>=this._startTime&&(-1===this._stopTime||t<=this._stopTime)?s.default.State.Started:s.default.State.Stopped},s.default.OscillatorNode.prototype.start=function(t){if(this.log("start",t),-1!==this._startTime)throw new Error("cannot call OscillatorNode.start more than once");return this._startTime=this.toSeconds(t),this._startTime=Math.max(this._startTime,this.context.currentTime),this._oscillator.start(this._startTime),this._gainNode.gain.setValueAtTime(1,this._startTime),this},s.default.OscillatorNode.prototype.setPeriodicWave=function(t){return this._oscillator.setPeriodicWave(t),this},s.default.OscillatorNode.prototype.stop=function(t){return this.log("stop",t),this.assert(-1!==this._startTime,"'start' must be called before 'stop'"),this.cancelStop(),this._stopTime=this.toSeconds(t),this._stopTime=Math.max(this._stopTime,this.context.currentTime),this._stopTime>this._startTime?(this._gainNode.gain.setValueAtTime(0,this._stopTime),this.context.clearTimeout(this._timeout),this._timeout=this.context.setTimeout(function(){this._oscillator.stop(this.now()),this.onended(),setTimeout(function(){this._oscillator&&(this._oscillator.disconnect(),this._gainNode.disconnect())}.bind(this),100)}.bind(this),this._stopTime-this.context.currentTime)):this._gainNode.gain.cancelScheduledValues(this._startTime),this},s.default.OscillatorNode.prototype.cancelStop=function(){return-1!==this._startTime&&(this._gainNode.gain.cancelScheduledValues(this._startTime+this.sampleTime),this.context.clearTimeout(this._timeout),this._stopTime=-1),this},Object.defineProperty(s.default.OscillatorNode.prototype,"type",{get:function(){return this._oscillator.type},set:function(t){this._oscillator.type=t}}),s.default.OscillatorNode.prototype.dispose=function(){return this._wasDisposed||(this._wasDisposed=!0,this.context.clearTimeout(this._timeout),s.default.AudioNode.prototype.dispose.call(this),this.onended=null,this._oscillator.disconnect(),this._oscillator=null,this._gainNode.dispose(),this._gainNode=null,this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null),this};e.default=s.default.OscillatorNode},function(t,e,i){"use strict";i.r(e);var s=i(0);i(11),i(6),i(57),i(32);s.default.Player=function(t){var e;t instanceof s.default.Buffer&&t.loaded?(t=t.get(),e=s.default.Player.defaults):e=s.default.defaults(arguments,["url","onload"],s.default.Player),s.default.Source.call(this,e),this.autostart=e.autostart,this._buffer=new s.default.Buffer({url:e.url,onload:this._onload.bind(this,e.onload),reverse:e.reverse}),t instanceof AudioBuffer&&this._buffer.set(t),this._loop=e.loop,this._loopStart=e.loopStart,this._loopEnd=e.loopEnd,this._playbackRate=e.playbackRate,this._activeSources=[],this.fadeIn=e.fadeIn,this.fadeOut=e.fadeOut},s.default.extend(s.default.Player,s.default.Source),s.default.Player.defaults={onload:s.default.noOp,playbackRate:1,loop:!1,autostart:!1,loopStart:0,loopEnd:0,reverse:!1,fadeIn:0,fadeOut:0},s.default.Player.prototype.load=function(t,e){return this._buffer.load(t,this._onload.bind(this,e))},s.default.Player.prototype._onload=function(t){(t=s.default.defaultArg(t,s.default.noOp))(this),this.autostart&&this.start()},s.default.Player.prototype._onSourceEnd=function(t){var e=this._activeSources.indexOf(t);this._activeSources.splice(e,1),0!==this._activeSources.length||this._synced||this._state.setStateAtTime(s.default.State.Stopped,s.default.now())},s.default.Player.prototype._start=function(t,e,i){e=this._loop?s.default.defaultArg(e,this._loopStart):s.default.defaultArg(e,0),e=this.toSeconds(e),this._synced&&(e*=this._playbackRate);var n=s.default.defaultArg(i,Math.max(this._buffer.duration-e,0));n=this.toSeconds(n),n/=this._playbackRate,t=this.toSeconds(t);var o=new s.default.BufferSource({buffer:this._buffer,loop:this._loop,loopStart:this._loopStart,loopEnd:this._loopEnd,onended:this._onSourceEnd.bind(this),playbackRate:this._playbackRate,fadeIn:this.fadeIn,fadeOut:this.fadeOut}).connect(this.output);return this._loop||this._synced||this._state.setStateAtTime(s.default.State.Stopped,t+n),this._activeSources.push(o),this._loop&&s.default.isUndef(i)?o.start(t,e):o.start(t,e,n-this.toSeconds(this.fadeOut)),this},s.default.Player.prototype._stop=function(t){return t=this.toSeconds(t),this._activeSources.forEach(function(e){e.stop(t)}),this},s.default.Player.prototype.restart=function(t,e,i){return this._stop(t),this._start(t,e,i),this},s.default.Player.prototype.seek=function(t,e){return e=this.toSeconds(e),this._state.getValueAtTime(e)===s.default.State.Started&&(t=this.toSeconds(t),this._stop(e),this._start(e,t)),this},s.default.Player.prototype.setLoopPoints=function(t,e){return this.loopStart=t,this.loopEnd=e,this},Object.defineProperty(s.default.Player.prototype,"loopStart",{get:function(){return this._loopStart},set:function(t){this._loopStart=t,this._activeSources.forEach(function(e){e.loopStart=t})}}),Object.defineProperty(s.default.Player.prototype,"loopEnd",{get:function(){return this._loopEnd},set:function(t){this._loopEnd=t,this._activeSources.forEach(function(e){e.loopEnd=t})}}),Object.defineProperty(s.default.Player.prototype,"buffer",{get:function(){return this._buffer},set:function(t){this._buffer.set(t)}}),Object.defineProperty(s.default.Player.prototype,"loop",{get:function(){return this._loop},set:function(t){if(this._loop!==t&&(this._loop=t,this._activeSources.forEach(function(e){e.loop=t}),t)){var e=this._state.getNextState(s.default.State.Stopped,this.now());e&&this._state.cancel(e.time)}}}),Object.defineProperty(s.default.Player.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t;var e=this.now(),i=this._state.getNextState(s.default.State.Stopped,e);i&&this._state.cancel(i.time),this._activeSources.forEach(function(i){i.cancelStop(),i.playbackRate.setValueAtTime(t,e)})}}),Object.defineProperty(s.default.Player.prototype,"reverse",{get:function(){return this._buffer.reverse},set:function(t){this._buffer.reverse=t}}),Object.defineProperty(s.default.Player.prototype,"loaded",{get:function(){return this._buffer.loaded}}),s.default.Player.prototype.dispose=function(){return this._activeSources.forEach(function(t){t.dispose()}),this._activeSources=null,s.default.Source.prototype.dispose.call(this),this._buffer.dispose(),this._buffer=null,this},e.default=s.default.Player},function(t,e,i){"use strict";i.r(e);var s=i(0);i(31),i(41),i(37),i(2),i(9),i(25);s.default.MonoSynth=function(t){t=s.default.defaultArg(t,s.default.MonoSynth.defaults),s.default.Monophonic.call(this,t),this.oscillator=new s.default.OmniOscillator(t.oscillator),this.frequency=this.oscillator.frequency,this.detune=this.oscillator.detune,this.filter=new s.default.Filter(t.filter),this.filter.frequency.value=5e3,this.filterEnvelope=new s.default.FrequencyEnvelope(t.filterEnvelope),this.envelope=new s.default.AmplitudeEnvelope(t.envelope),this.oscillator.chain(this.filter,this.envelope,this.output),this.filterEnvelope.connect(this.filter.frequency),this._readOnly(["oscillator","frequency","detune","filter","filterEnvelope","envelope"])},s.default.extend(s.default.MonoSynth,s.default.Monophonic),s.default.MonoSynth.defaults={frequency:"C4",detune:0,oscillator:{type:"square"},filter:{Q:6,type:"lowpass",rolloff:-24},envelope:{attack:.005,decay:.1,sustain:.9,release:1},filterEnvelope:{attack:.06,decay:.2,sustain:.5,release:2,baseFrequency:200,octaves:7,exponent:2}},s.default.MonoSynth.prototype._triggerEnvelopeAttack=function(t,e){return t=this.toSeconds(t),this.envelope.triggerAttack(t,e),this.filterEnvelope.triggerAttack(t),this.oscillator.start(t),0===this.envelope.sustain&&this.oscillator.stop(t+this.envelope.attack+this.envelope.decay),this},s.default.MonoSynth.prototype._triggerEnvelopeRelease=function(t){return this.envelope.triggerRelease(t),this.filterEnvelope.triggerRelease(t),this.oscillator.stop(t+this.envelope.release),this},s.default.MonoSynth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["oscillator","frequency","detune","filter","filterEnvelope","envelope"]),this.oscillator.dispose(),this.oscillator=null,this.envelope.dispose(),this.envelope=null,this.filterEnvelope.dispose(),this.filterEnvelope=null,this.filter.dispose(),this.filter=null,this.frequency=null,this.detune=null,this},e.default=s.default.MonoSynth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(6),i(17),i(5),i(3);s.default.FatOscillator=function(){var t=s.default.defaults(arguments,["frequency","type","spread"],s.default.FatOscillator);s.default.Source.call(this,t),this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this._oscillators=[],this._spread=t.spread,this._type=t.type,this._phase=t.phase,this._partials=t.partials,this._partialCount=t.partialCount,this.count=t.count,this._readOnly(["frequency","detune"])},s.default.extend(s.default.FatOscillator,s.default.Source),s.default.FatOscillator.defaults={frequency:440,detune:0,phase:0,spread:20,count:3,type:"sawtooth",partials:[],partialCount:0},s.default.FatOscillator.prototype._start=function(t){t=this.toSeconds(t),this._forEach(function(e){e.start(t)})},s.default.FatOscillator.prototype._stop=function(t){t=this.toSeconds(t),this._forEach(function(e){e.stop(t)})},s.default.FatOscillator.prototype.restart=function(t){t=this.toSeconds(t),this._forEach(function(e){e.restart(t)})},s.default.FatOscillator.prototype._forEach=function(t){for(var e=0;e<this._oscillators.length;e++)t.call(this,this._oscillators[e],e)},Object.defineProperty(s.default.FatOscillator.prototype,"type",{get:function(){return this._type},set:function(t){this._type=t,this._forEach(function(e){e.type=t})}}),Object.defineProperty(s.default.FatOscillator.prototype,"spread",{get:function(){return this._spread},set:function(t){if(this._spread=t,this._oscillators.length>1){var e=-t/2,i=t/(this._oscillators.length-1);this._forEach(function(t,s){t.detune.value=e+i*s})}}}),Object.defineProperty(s.default.FatOscillator.prototype,"count",{get:function(){return this._oscillators.length},set:function(t){if(t=Math.max(t,1),this._oscillators.length!==t){this._forEach(function(t){t.dispose()}),this._oscillators=[];for(var e=0;e<t;e++){var i=new s.default.Oscillator;this.type===s.default.Oscillator.Type.Custom?i.partials=this._partials:i.type=this._type,i.partialCount=this._partialCount,i.phase=this._phase+e/t*360,i.volume.value=-6-1.1*t,this.frequency.connect(i.frequency),this.detune.connect(i.detune),i.connect(this.output),this._oscillators[e]=i}this.spread=this._spread,this.state===s.default.State.Started&&this._forEach(function(t){t.start()})}}}),Object.defineProperty(s.default.FatOscillator.prototype,"phase",{get:function(){return this._phase},set:function(t){this._phase=t,this._forEach(function(e){e.phase=t})}}),Object.defineProperty(s.default.FatOscillator.prototype,"baseType",{get:function(){return this._oscillators[0].baseType},set:function(t){this._forEach(function(e){e.baseType=t}),this._type=this._oscillators[0].type}}),Object.defineProperty(s.default.FatOscillator.prototype,"partials",{get:function(){return this._oscillators[0].partials},set:function(t){this._partials=t,this._type=s.default.Oscillator.Type.Custom,this._forEach(function(e){e.partials=t})}}),Object.defineProperty(s.default.FatOscillator.prototype,"partialCount",{get:function(){return this._oscillators[0].partialCount},set:function(t){this._partialCount=t,this._forEach(function(e){e.partialCount=t}),this._type=this._oscillators[0].type}}),s.default.FatOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._writable(["frequency","detune"]),this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null,this._forEach(function(t){t.dispose()}),this._oscillators=null,this._partials=null,this},e.default=s.default.FatOscillator},function(t,e,i){"use strict";i.r(e);var s=i(0);i(6),i(17),i(5),i(3),i(22);s.default.AMOscillator=function(){var t=s.default.defaults(arguments,["frequency","type","modulationType"],s.default.AMOscillator);s.default.Source.call(this,t),this._carrier=new s.default.Oscillator(t.frequency,t.type),this.frequency=this._carrier.frequency,this.detune=this._carrier.detune,this.detune.value=t.detune,this._modulator=new s.default.Oscillator(t.frequency,t.modulationType),this._modulationScale=new s.default.AudioToGain,this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this._modulationNode=new s.default.Gain(0),this.frequency.chain(this.harmonicity,this._modulator.frequency),this.detune.connect(this._modulator.detune),this._modulator.chain(this._modulationScale,this._modulationNode.gain),this._carrier.chain(this._modulationNode,this.output),this.phase=t.phase,this._readOnly(["frequency","detune","harmonicity"])},s.default.extend(s.default.AMOscillator,s.default.Oscillator),s.default.AMOscillator.defaults={frequency:440,detune:0,phase:0,type:"sine",modulationType:"square",harmonicity:1},s.default.AMOscillator.prototype._start=function(t){this._modulator.start(t),this._carrier.start(t)},s.default.AMOscillator.prototype._stop=function(t){this._modulator.stop(t),this._carrier.stop(t)},s.default.AMOscillator.prototype.restart=function(t){this._modulator.restart(t),this._carrier.restart(t)},Object.defineProperty(s.default.AMOscillator.prototype,"type",{get:function(){return this._carrier.type},set:function(t){this._carrier.type=t}}),Object.defineProperty(s.default.AMOscillator.prototype,"baseType",{get:function(){return this._carrier.baseType},set:function(t){this._carrier.baseType=t}}),Object.defineProperty(s.default.AMOscillator.prototype,"partialCount",{get:function(){return this._carrier.partialCount},set:function(t){this._carrier.partialCount=t}}),Object.defineProperty(s.default.AMOscillator.prototype,"modulationType",{get:function(){return this._modulator.type},set:function(t){this._modulator.type=t}}),Object.defineProperty(s.default.AMOscillator.prototype,"phase",{get:function(){return this._carrier.phase},set:function(t){this._carrier.phase=t,this._modulator.phase=t}}),Object.defineProperty(s.default.AMOscillator.prototype,"partials",{get:function(){return this._carrier.partials},set:function(t){this._carrier.partials=t}}),s.default.AMOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._writable(["frequency","detune","harmonicity"]),this.frequency=null,this.detune=null,this.harmonicity.dispose(),this.harmonicity=null,this._carrier.dispose(),this._carrier=null,this._modulator.dispose(),this._modulator=null,this._modulationNode.dispose(),this._modulationNode=null,this._modulationScale.dispose(),this._modulationScale=null,this},e.default=s.default.AMOscillator},function(t,e,i){"use strict";i.r(e);var s=i(0);i(6),i(50),i(17),i(5);s.default.PWMOscillator=function(){var t=s.default.defaults(arguments,["frequency","modulationFrequency"],s.default.PWMOscillator);s.default.Source.call(this,t),this._pulse=new s.default.PulseOscillator(t.modulationFrequency),this._pulse._sawtooth.type="sine",this._modulator=new s.default.Oscillator({frequency:t.frequency,detune:t.detune,phase:t.phase}),this._scale=new s.default.Multiply(2),this.frequency=this._modulator.frequency,this.detune=this._modulator.detune,this.modulationFrequency=this._pulse.frequency,this._modulator.chain(this._scale,this._pulse.width),this._pulse.connect(this.output),this._readOnly(["modulationFrequency","frequency","detune"])},s.default.extend(s.default.PWMOscillator,s.default.Source),s.default.PWMOscillator.defaults={frequency:440,detune:0,phase:0,modulationFrequency:.4},s.default.PWMOscillator.prototype._start=function(t){t=this.toSeconds(t),this._modulator.start(t),this._pulse.start(t)},s.default.PWMOscillator.prototype._stop=function(t){t=this.toSeconds(t),this._modulator.stop(t),this._pulse.stop(t)},s.default.PWMOscillator.prototype.restart=function(t){this._modulator.restart(t),this._pulse.restart(t)},Object.defineProperty(s.default.PWMOscillator.prototype,"type",{get:function(){return"pwm"}}),Object.defineProperty(s.default.PWMOscillator.prototype,"baseType",{get:function(){return"pwm"}}),Object.defineProperty(s.default.PWMOscillator.prototype,"partials",{get:function(){return[]}}),Object.defineProperty(s.default.PWMOscillator.prototype,"phase",{get:function(){return this._modulator.phase},set:function(t){this._modulator.phase=t}}),s.default.PWMOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._pulse.dispose(),this._pulse=null,this._scale.dispose(),this._scale=null,this._modulator.dispose(),this._modulator=null,this._writable(["modulationFrequency","frequency","detune"]),this.frequency=null,this.detune=null,this.modulationFrequency=null,this},e.default=s.default.PWMOscillator},function(t,e,i){"use strict";i.r(e);var s=i(0);i(51),i(4),i(16);s.default.Part=function(){var t=s.default.defaults(arguments,["callback","events"],s.default.Part);s.default.Event.call(this,t),this._events=[];for(var e=0;e<t.events.length;e++)Array.isArray(t.events[e])?this.add(t.events[e][0],t.events[e][1]):this.add(t.events[e])},s.default.extend(s.default.Part,s.default.Event),s.default.Part.defaults={callback:s.default.noOp,loop:!1,loopEnd:"1m",loopStart:0,playbackRate:1,probability:1,humanize:!1,mute:!1,events:[]},s.default.Part.prototype.start=function(t,e){var i=this.toTicks(t);return this._state.getValueAtTime(i)!==s.default.State.Started&&(e=this._loop?s.default.defaultArg(e,this._loopStart):s.default.defaultArg(e,0),e=this.toTicks(e),this._state.add({state:s.default.State.Started,time:i,offset:e}),this._forEach(function(t){this._startNote(t,i,e)})),this},s.default.Part.prototype._startNote=function(t,e,i){e-=i,this._loop?t.startOffset>=this._loopStart&&t.startOffset<this._loopEnd?(t.startOffset<i&&(e+=this._getLoopDuration()),t.start(s.default.Ticks(e))):t.startOffset<this._loopStart&&t.startOffset>=i&&(t.loop=!1,t.start(s.default.Ticks(e))):t.startOffset>=i&&t.start(s.default.Ticks(e))},Object.defineProperty(s.default.Part.prototype,"startOffset",{get:function(){return this._startOffset},set:function(t){this._startOffset=t,this._forEach(function(t){t.startOffset+=this._startOffset})}}),s.default.Part.prototype.stop=function(t){var e=this.toTicks(t);return this._state.cancel(e),this._state.setStateAtTime(s.default.State.Stopped,e),this._forEach(function(e){e.stop(t)}),this},s.default.Part.prototype.at=function(t,e){t=s.default.TransportTime(t);for(var i=s.default.Ticks(1).toSeconds(),n=0;n<this._events.length;n++){var o=this._events[n];if(Math.abs(t.toTicks()-o.startOffset)<i)return s.default.isDefined(e)&&(o.value=e),o}return s.default.isDefined(e)?(this.add(t,e),this._events[this._events.length-1]):null},s.default.Part.prototype.add=function(t,e){var i;return t.hasOwnProperty("time")&&(t=(e=t).time),t=this.toTicks(t),e instanceof s.default.Event?(i=e).callback=this._tick.bind(this):i=new s.default.Event({callback:this._tick.bind(this),value:e}),i.startOffset=t,i.set({loopEnd:this.loopEnd,loopStart:this.loopStart,loop:this.loop,humanize:this.humanize,playbackRate:this.playbackRate,probability:this.probability}),this._events.push(i),this._restartEvent(i),this},s.default.Part.prototype._restartEvent=function(t){this._state.forEach(function(e){e.state===s.default.State.Started?this._startNote(t,e.time,e.offset):t.stop(s.default.Ticks(e.time))}.bind(this))},s.default.Part.prototype.remove=function(t,e){t.hasOwnProperty("time")&&(t=(e=t).time),t=this.toTicks(t);for(var i=this._events.length-1;i>=0;i--){var n=this._events[i];n.startOffset===t&&(s.default.isUndef(e)||s.default.isDefined(e)&&n.value===e)&&(this._events.splice(i,1),n.dispose())}return this},s.default.Part.prototype.removeAll=function(){return this._forEach(function(t){t.dispose()}),this._events=[],this},s.default.Part.prototype.cancel=function(t){return this._forEach(function(e){e.cancel(t)}),this._state.cancel(this.toTicks(t)),this},s.default.Part.prototype._forEach=function(t,e){if(this._events){e=s.default.defaultArg(e,this);for(var i=this._events.length-1;i>=0;i--){var n=this._events[i];n instanceof s.default.Part?n._forEach(t,e):t.call(e,n)}}return this},s.default.Part.prototype._setAll=function(t,e){this._forEach(function(i){i[t]=e})},s.default.Part.prototype._tick=function(t,e){this.mute||this.callback(t,e)},s.default.Part.prototype._testLoopBoundries=function(t){this._loop&&(t.startOffset<this._loopStart||t.startOffset>=this._loopEnd)?t.cancel(0):t.state===s.default.State.Stopped&&this._restartEvent(t)},Object.defineProperty(s.default.Part.prototype,"probability",{get:function(){return this._probability},set:function(t){this._probability=t,this._setAll("probability",t)}}),Object.defineProperty(s.default.Part.prototype,"humanize",{get:function(){return this._humanize},set:function(t){this._humanize=t,this._setAll("humanize",t)}}),Object.defineProperty(s.default.Part.prototype,"loop",{get:function(){return this._loop},set:function(t){this._loop=t,this._forEach(function(e){e._loopStart=this._loopStart,e._loopEnd=this._loopEnd,e.loop=t,this._testLoopBoundries(e)})}}),Object.defineProperty(s.default.Part.prototype,"loopEnd",{get:function(){return s.default.Ticks(this._loopEnd).toSeconds()},set:function(t){this._loopEnd=this.toTicks(t),this._loop&&this._forEach(function(e){e.loopEnd=t,this._testLoopBoundries(e)})}}),Object.defineProperty(s.default.Part.prototype,"loopStart",{get:function(){return s.default.Ticks(this._loopStart).toSeconds()},set:function(t){this._loopStart=this.toTicks(t),this._loop&&this._forEach(function(t){t.loopStart=this.loopStart,this._testLoopBoundries(t)})}}),Object.defineProperty(s.default.Part.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t,this._setAll("playbackRate",t)}}),Object.defineProperty(s.default.Part.prototype,"length",{get:function(){return this._events.length}}),s.default.Part.prototype.dispose=function(){return s.default.Event.prototype.dispose.call(this),this.removeAll(),this.callback=null,this._events=null,this},e.default=s.default.Part},function(t,e,i){"use strict";i.r(e);var s=i(0);i(51);s.default.Loop=function(){var t=s.default.defaults(arguments,["callback","interval"],s.default.Loop);s.default.call(this),this._event=new s.default.Event({callback:this._tick.bind(this),loop:!0,loopEnd:t.interval,playbackRate:t.playbackRate,probability:t.probability}),this.callback=t.callback,this.iterations=t.iterations},s.default.extend(s.default.Loop),s.default.Loop.defaults={interval:"4n",callback:s.default.noOp,playbackRate:1,iterations:1/0,probability:!0,mute:!1},s.default.Loop.prototype.start=function(t){return this._event.start(t),this},s.default.Loop.prototype.stop=function(t){return this._event.stop(t),this},s.default.Loop.prototype.cancel=function(t){return this._event.cancel(t),this},s.default.Loop.prototype._tick=function(t){this.callback(t)},Object.defineProperty(s.default.Loop.prototype,"state",{get:function(){return this._event.state}}),Object.defineProperty(s.default.Loop.prototype,"progress",{get:function(){return this._event.progress}}),Object.defineProperty(s.default.Loop.prototype,"interval",{get:function(){return this._event.loopEnd},set:function(t){this._event.loopEnd=t}}),Object.defineProperty(s.default.Loop.prototype,"playbackRate",{get:function(){return this._event.playbackRate},set:function(t){this._event.playbackRate=t}}),Object.defineProperty(s.default.Loop.prototype,"humanize",{get:function(){return this._event.humanize},set:function(t){this._event.humanize=t}}),Object.defineProperty(s.default.Loop.prototype,"probability",{get:function(){return this._event.probability},set:function(t){this._event.probability=t}}),Object.defineProperty(s.default.Loop.prototype,"mute",{get:function(){return this._event.mute},set:function(t){this._event.mute=t}}),Object.defineProperty(s.default.Loop.prototype,"iterations",{get:function(){return!0===this._event.loop?1/0:this._event.loop},set:function(t){this._event.loop=t===1/0||t}}),s.default.Loop.prototype.dispose=function(){this._event.dispose(),this._event=null,this.callback=null},e.default=s.default.Loop},function(t,e,i){"use strict";i.r(e);var s=i(0);i(15),i(33);s.default.StereoXFeedbackEffect=function(){var t=s.default.defaults(arguments,["feedback"],s.default.FeedbackEffect);s.default.StereoEffect.call(this,t),this.feedback=new s.default.Signal(t.feedback,s.default.Type.NormalRange),this._feedbackLR=new s.default.Gain,this._feedbackRL=new s.default.Gain,this.effectReturnL.chain(this._feedbackLR,this.effectSendR),this.effectReturnR.chain(this._feedbackRL,this.effectSendL),this.feedback.fan(this._feedbackLR.gain,this._feedbackRL.gain),this._readOnly(["feedback"])},s.default.extend(s.default.StereoXFeedbackEffect,s.default.StereoEffect),s.default.StereoXFeedbackEffect.prototype.dispose=function(){return s.default.StereoEffect.prototype.dispose.call(this),this._writable(["feedback"]),this.feedback.dispose(),this.feedback=null,this._feedbackLR.dispose(),this._feedbackLR=null,this._feedbackRL.dispose(),this._feedbackRL=null,this},e.default=s.default.StereoXFeedbackEffect},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(53),i(52);s.default.MidSideEffect=function(){s.default.Effect.apply(this,arguments),this._midSideSplit=new s.default.MidSideSplit,this._midSideMerge=new s.default.MidSideMerge,this.midSend=this._midSideSplit.mid,this.sideSend=this._midSideSplit.side,this.midReturn=this._midSideMerge.mid,this.sideReturn=this._midSideMerge.side,this.effectSend.connect(this._midSideSplit),this._midSideMerge.connect(this.effectReturn)},s.default.extend(s.default.MidSideEffect,s.default.Effect),s.default.MidSideEffect.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._midSideSplit.dispose(),this._midSideSplit=null,this._midSideMerge.dispose(),this._midSideMerge=null,this.midSend=null,this.sideSend=null,this.midReturn=null,this.sideReturn=null,this},e.default=s.default.MidSideEffect},function(t,e,i){"use strict";i.r(e);var s=i(0);i(11),i(8);s.default.Convolver=function(){var t=s.default.defaults(arguments,["url","onload"],s.default.Convolver);s.default.Effect.call(this,t),this._convolver=this.context.createConvolver(),this._buffer=new s.default.Buffer(t.url,function(e){this.buffer=e.get(),t.onload()}.bind(this)),this._buffer.loaded&&(this.buffer=this._buffer),this.normalize=t.normalize,this.connectEffect(this._convolver)},s.default.extend(s.default.Convolver,s.default.Effect),s.default.Convolver.defaults={onload:s.default.noOp,normalize:!0},Object.defineProperty(s.default.Convolver.prototype,"buffer",{get:function(){return this._buffer.length?this._buffer:null},set:function(t){this._buffer.set(t),this._convolver.buffer&&(this.effectSend.disconnect(),this._convolver.disconnect(),this._convolver=this.context.createConvolver(),this.connectEffect(this._convolver)),this._convolver.buffer=this._buffer.get()}}),Object.defineProperty(s.default.Convolver.prototype,"normalize",{get:function(){return this._convolver.normalize},set:function(t){this._convolver.normalize=t}}),s.default.Convolver.prototype.load=function(t,e){return this._buffer.load(t,function(t){this.buffer=t,e&&e()}.bind(this))},s.default.Convolver.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._buffer.dispose(),this._buffer=null,this._convolver.disconnect(),this._convolver=null,this},e.default=s.default.Convolver},function(t,e,i){"use strict";i.r(e);var s=i(0);i(7),i(5),i(13);s.default.Modulo=function(t){s.default.SignalBase.call(this),this.createInsOuts(1,0),this._shaper=new s.default.WaveShaper(Math.pow(2,16)),this._multiply=new s.default.Multiply,this._subtract=this.output=new s.default.Subtract,this._modSignal=new s.default.Signal(t),s.default.connect(this.input,this._shaper),s.default.connect(this.input,this._subtract),this._modSignal.connect(this._multiply,0,0),this._shaper.connect(this._multiply,0,1),this._multiply.connect(this._subtract,0,1),this._setWaveShaper(t)},s.default.extend(s.default.Modulo,s.default.SignalBase),s.default.Modulo.prototype._setWaveShaper=function(t){this._shaper.setMap(function(e){return Math.floor((e+1e-4)/t)})},Object.defineProperty(s.default.Modulo.prototype,"value",{get:function(){return this._modSignal.value},set:function(t){this._modSignal.value=t,this._setWaveShaper(t)}}),s.default.Modulo.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._shaper.dispose(),this._shaper=null,this._multiply.dispose(),this._multiply=null,this._subtract.dispose(),this._subtract=null,this._modSignal.dispose(),this._modSignal=null,this},e.default=s.default.Modulo},function(t,e,i){"use strict";i.r(e);var s=i(0);i(20),i(92);s.default.OfflineContext=function(t,e,i){var n=new OfflineAudioContext(t,e*i,i);s.default.Context.call(this,{context:n,clockSource:"offline",lookAhead:0,updateInterval:128/i}),this._duration=e,this._currentTime=0},s.default.extend(s.default.OfflineContext,s.default.Context),s.default.OfflineContext.prototype.now=function(){return this._currentTime},s.default.OfflineContext.prototype.resume=function(){return Promise.resolve()},s.default.OfflineContext.prototype.render=function(){for(;this._duration-this._currentTime>=0;)this.emit("tick"),this._currentTime+=.005;return this._context.startRendering()},s.default.OfflineContext.prototype.close=function(){return this._context=null,Promise.resolve()},e.default=s.default.OfflineContext},function(t,e,i){"use strict";i.r(e);var s=i(0);i(16),i(11),i(76),i(40);s.default.Offline=function(t,e){var i=s.default.context.sampleRate,n=s.default.context,o=new s.default.OfflineContext(2,e,i);s.default.context=o;var a=t(s.default.Transport),r=null;return r=a&&s.default.isFunction(a.then)?a.then(function(){return o.render()}):o.render(),s.default.context=n,r.then(function(t){return new s.default.Buffer(t)})},e.default=s.default.Offline},function(t,e,i){"use strict";i.r(e);var s=i(0);i(11);s.default.Buffers=function(t){var e=Array.prototype.slice.call(arguments);e.shift();var i=s.default.defaults(e,["onload","baseUrl"],s.default.Buffers);for(var n in s.default.call(this),this._buffers={},this.baseUrl=i.baseUrl,this._loadingCount=0,t)this._loadingCount++,this.add(n,t[n],this._bufferLoaded.bind(this,i.onload))},s.default.extend(s.default.Buffers),s.default.Buffers.defaults={onload:s.default.noOp,baseUrl:""},s.default.Buffers.prototype.has=function(t){return this._buffers.hasOwnProperty(t)},s.default.Buffers.prototype.get=function(t){if(this.has(t))return this._buffers[t];throw new Error("Tone.Buffers: no buffer named "+t)},s.default.Buffers.prototype._bufferLoaded=function(t){this._loadingCount--,0===this._loadingCount&&t&&t(this)},Object.defineProperty(s.default.Buffers.prototype,"loaded",{get:function(){var t=!0;for(var e in this._buffers){var i=this.get(e);t=t&&i.loaded}return t}}),s.default.Buffers.prototype.add=function(t,e,i){return i=s.default.defaultArg(i,s.default.noOp),e instanceof s.default.Buffer?(this._buffers[t]=e,i(this)):e instanceof AudioBuffer?(this._buffers[t]=new s.default.Buffer(e),i(this)):s.default.isString(e)&&(this._buffers[t]=new s.default.Buffer(this.baseUrl+e,i)),this},s.default.Buffers.prototype.dispose=function(){for(var t in s.default.prototype.dispose.call(this),this._buffers)this._buffers[t].dispose();return this._buffers=null,this},e.default=s.default.Buffers},function(t,e,i){"use strict";i.r(e);var s=i(0);s.default.CtrlPattern=function(){var t=s.default.defaults(arguments,["values","type"],s.default.CtrlPattern);s.default.call(this),this.values=t.values,this.index=0,this._type=null,this._shuffled=null,this._direction=null,this.type=t.type},s.default.extend(s.default.CtrlPattern),s.default.CtrlPattern.Type={Up:"up",Down:"down",UpDown:"upDown",DownUp:"downUp",AlternateUp:"alternateUp",AlternateDown:"alternateDown",Random:"random",RandomWalk:"randomWalk",RandomOnce:"randomOnce"},s.default.CtrlPattern.defaults={type:s.default.CtrlPattern.Type.Up,values:[]},Object.defineProperty(s.default.CtrlPattern.prototype,"value",{get:function(){if(0!==this.values.length){if(1===this.values.length)return this.values[0];this.index=Math.min(this.index,this.values.length-1);var t=this.values[this.index];return this.type===s.default.CtrlPattern.Type.RandomOnce&&(this.values.length!==this._shuffled.length&&this._shuffleValues(),t=this.values[this._shuffled[this.index]]),t}}}),Object.defineProperty(s.default.CtrlPattern.prototype,"type",{get:function(){return this._type},set:function(t){this._type=t,this._shuffled=null,this._type===s.default.CtrlPattern.Type.Up||this._type===s.default.CtrlPattern.Type.UpDown||this._type===s.default.CtrlPattern.Type.RandomOnce||this._type===s.default.CtrlPattern.Type.AlternateUp?this.index=0:this._type!==s.default.CtrlPattern.Type.Down&&this._type!==s.default.CtrlPattern.Type.DownUp&&this._type!==s.default.CtrlPattern.Type.AlternateDown||(this.index=this.values.length-1),this._type===s.default.CtrlPattern.Type.UpDown||this._type===s.default.CtrlPattern.Type.AlternateUp?this._direction=s.default.CtrlPattern.Type.Up:this._type!==s.default.CtrlPattern.Type.DownUp&&this._type!==s.default.CtrlPattern.Type.AlternateDown||(this._direction=s.default.CtrlPattern.Type.Down),this._type===s.default.CtrlPattern.Type.RandomOnce?this._shuffleValues():this._type===s.default.CtrlPattern.Type.Random&&(this.index=Math.floor(Math.random()*this.values.length))}}),s.default.CtrlPattern.prototype.next=function(){var t=this.type;return t===s.default.CtrlPattern.Type.Up?(this.index++,this.index>=this.values.length&&(this.index=0)):t===s.default.CtrlPattern.Type.Down?(this.index--,this.index<0&&(this.index=this.values.length-1)):t===s.default.CtrlPattern.Type.UpDown||t===s.default.CtrlPattern.Type.DownUp?(this._direction===s.default.CtrlPattern.Type.Up?this.index++:this.index--,this.index<0?(this.index=1,this._direction=s.default.CtrlPattern.Type.Up):this.index>=this.values.length&&(this.index=this.values.length-2,this._direction=s.default.CtrlPattern.Type.Down)):t===s.default.CtrlPattern.Type.Random?this.index=Math.floor(Math.random()*this.values.length):t===s.default.CtrlPattern.Type.RandomWalk?Math.random()<.5?(this.index--,this.index=Math.max(this.index,0)):(this.index++,this.index=Math.min(this.index,this.values.length-1)):t===s.default.CtrlPattern.Type.RandomOnce?(this.index++,this.index>=this.values.length&&(this.index=0,this._shuffleValues())):t===s.default.CtrlPattern.Type.AlternateUp?(this._direction===s.default.CtrlPattern.Type.Up?(this.index+=2,this._direction=s.default.CtrlPattern.Type.Down):(this.index-=1,this._direction=s.default.CtrlPattern.Type.Up),this.index>=this.values.length&&(this.index=0,this._direction=s.default.CtrlPattern.Type.Up)):t===s.default.CtrlPattern.Type.AlternateDown&&(this._direction===s.default.CtrlPattern.Type.Up?(this.index+=1,this._direction=s.default.CtrlPattern.Type.Down):(this.index-=2,this._direction=s.default.CtrlPattern.Type.Up),this.index<0&&(this.index=this.values.length-1,this._direction=s.default.CtrlPattern.Type.Down)),this.value},s.default.CtrlPattern.prototype._shuffleValues=function(){var t=[];this._shuffled=[];for(var e=0;e<this.values.length;e++)t[e]=e;for(;t.length>0;){var i=t.splice(Math.floor(t.length*Math.random()),1);this._shuffled.push(i[0])}},s.default.CtrlPattern.prototype.dispose=function(){this._shuffled=null,this.values=null},e.default=s.default.CtrlPattern},function(t,e,i){"use strict";i.r(e);var s=i(0);i(56),i(55);s.default.TransportRepeatEvent=function(t,e){s.default.TransportEvent.call(this,t,e),e=s.default.defaultArg(e,s.default.TransportRepeatEvent.defaults),this.duration=s.default.Ticks(e.duration),this._interval=s.default.Ticks(e.interval),this._currentId=-1,this._nextId=-1,this._nextTick=this.time,this._boundRestart=this._restart.bind(this),this.Transport.on("start loopStart",this._boundRestart),this._restart()},s.default.extend(s.default.TransportRepeatEvent,s.default.TransportEvent),s.default.TransportRepeatEvent.defaults={duration:1/0,interval:1},s.default.TransportRepeatEvent.prototype.invoke=function(t){this._createEvents(t),s.default.TransportEvent.prototype.invoke.call(this,t)},s.default.TransportRepeatEvent.prototype._createEvents=function(t){var e=this.Transport.getTicksAtTime(t);e>=this.time&&e>=this._nextTick&&this._nextTick+this._interval<this.time+this.duration&&(this._nextTick+=this._interval,this._currentId=this._nextId,this._nextId=this.Transport.scheduleOnce(this.invoke.bind(this),s.default.Ticks(this._nextTick)))},s.default.TransportRepeatEvent.prototype._restart=function(t){this.Transport.clear(this._currentId),this.Transport.clear(this._nextId),this._nextTick=this.time;var e=this.Transport.getTicksAtTime(t);e>this.time&&(this._nextTick=this.time+Math.ceil((e-this.time)/this._interval)*this._interval),this._currentId=this.Transport.scheduleOnce(this.invoke.bind(this),s.default.Ticks(this._nextTick)),this._nextTick+=this._interval,this._nextId=this.Transport.scheduleOnce(this.invoke.bind(this),s.default.Ticks(this._nextTick))},s.default.TransportRepeatEvent.prototype.dispose=function(){return this.Transport.clear(this._currentId),this.Transport.clear(this._nextId),this.Transport.off("start loopStart",this._boundRestart),this._boundCreateEvents=null,s.default.TransportEvent.prototype.dispose.call(this),this.duration=null,this._interval=null,this},e.default=s.default.TransportRepeatEvent},function(t,e,i){"use strict";i.r(e);var s=i(0);i(4);s.default.IntervalTimeline=function(){s.default.call(this),this._root=null,this._length=0},s.default.extend(s.default.IntervalTimeline),s.default.IntervalTimeline.prototype.add=function(t){if(s.default.isUndef(t.time)||s.default.isUndef(t.duration))throw new Error("Tone.IntervalTimeline: events must have time and duration parameters");t.time=t.time.valueOf();var e=new n(t.time,t.time+t.duration,t);for(null===this._root?this._root=e:this._root.insert(e),this._length++;null!==e;)e.updateHeight(),e.updateMax(),this._rebalance(e),e=e.parent;return this},s.default.IntervalTimeline.prototype.remove=function(t){if(null!==this._root){var e=[];this._root.search(t.time,e);for(var i=0;i<e.length;i++){var s=e[i];if(s.event===t){this._removeNode(s),this._length--;break}}}return this},Object.defineProperty(s.default.IntervalTimeline.prototype,"length",{get:function(){return this._length}}),s.default.IntervalTimeline.prototype.cancel=function(t){return this.forEachFrom(t,function(t){this.remove(t)}.bind(this)),this},s.default.IntervalTimeline.prototype._setRoot=function(t){this._root=t,null!==this._root&&(this._root.parent=null)},s.default.IntervalTimeline.prototype._replaceNodeInParent=function(t,e){null!==t.parent?(t.isLeftChild()?t.parent.left=e:t.parent.right=e,this._rebalance(t.parent)):this._setRoot(e)},s.default.IntervalTimeline.prototype._removeNode=function(t){if(null===t.left&&null===t.right)this._replaceNodeInParent(t,null);else if(null===t.right)this._replaceNodeInParent(t,t.left);else if(null===t.left)this._replaceNodeInParent(t,t.right);else{var e,i;if(t.getBalance()>0)if(null===t.left.right)(e=t.left).right=t.right,i=e;else{for(e=t.left.right;null!==e.right;)e=e.right;e.parent.right=e.left,i=e.parent,e.left=t.left,e.right=t.right}else if(null===t.right.left)(e=t.right).left=t.left,i=e;else{for(e=t.right.left;null!==e.left;)e=e.left;e.parent.left=e.right,i=e.parent,e.left=t.left,e.right=t.right}null!==t.parent?t.isLeftChild()?t.parent.left=e:t.parent.right=e:this._setRoot(e),this._rebalance(i)}t.dispose()},s.default.IntervalTimeline.prototype._rotateLeft=function(t){var e=t.parent,i=t.isLeftChild(),s=t.right;t.right=s.left,s.left=t,null!==e?i?e.left=s:e.right=s:this._setRoot(s)},s.default.IntervalTimeline.prototype._rotateRight=function(t){var e=t.parent,i=t.isLeftChild(),s=t.left;t.left=s.right,s.right=t,null!==e?i?e.left=s:e.right=s:this._setRoot(s)},s.default.IntervalTimeline.prototype._rebalance=function(t){var e=t.getBalance();e>1?t.left.getBalance()<0?this._rotateLeft(t.left):this._rotateRight(t):e<-1&&(t.right.getBalance()>0?this._rotateRight(t.right):this._rotateLeft(t))},s.default.IntervalTimeline.prototype.get=function(t){if(null!==this._root){var e=[];if(this._root.search(t,e),e.length>0){for(var i=e[0],s=1;s<e.length;s++)e[s].low>i.low&&(i=e[s]);return i.event}}return null},s.default.IntervalTimeline.prototype.forEach=function(t){if(null!==this._root){var e=[];this._root.traverse(function(t){e.push(t)});for(var i=0;i<e.length;i++){var s=e[i].event;s&&t(s)}}return this},s.default.IntervalTimeline.prototype.forEachAtTime=function(t,e){if(null!==this._root){var i=[];this._root.search(t,i);for(var s=i.length-1;s>=0;s--){var n=i[s].event;n&&e(n)}}return this},s.default.IntervalTimeline.prototype.forEachFrom=function(t,e){if(null!==this._root){var i=[];this._root.searchAfter(t,i);for(var s=i.length-1;s>=0;s--){e(i[s].event)}}return this},s.default.IntervalTimeline.prototype.dispose=function(){var t=[];null!==this._root&&this._root.traverse(function(e){t.push(e)});for(var e=0;e<t.length;e++)t[e].dispose();return t=null,this._root=null,this};var n=function(t,e,i){this.event=i,this.low=t,this.high=e,this.max=this.high,this._left=null,this._right=null,this.parent=null,this.height=0};n.prototype.insert=function(t){t.low<=this.low?null===this.left?this.left=t:this.left.insert(t):null===this.right?this.right=t:this.right.insert(t)},n.prototype.search=function(t,e){t>this.max||(null!==this.left&&this.left.search(t,e),this.low<=t&&this.high>t&&e.push(this),this.low>t||null!==this.right&&this.right.search(t,e))},n.prototype.searchAfter=function(t,e){this.low>=t&&(e.push(this),null!==this.left&&this.left.searchAfter(t,e)),null!==this.right&&this.right.searchAfter(t,e)},n.prototype.traverse=function(t){t(this),null!==this.left&&this.left.traverse(t),null!==this.right&&this.right.traverse(t)},n.prototype.updateHeight=function(){null!==this.left&&null!==this.right?this.height=Math.max(this.left.height,this.right.height)+1:null!==this.right?this.height=this.right.height+1:null!==this.left?this.height=this.left.height+1:this.height=0},n.prototype.updateMax=function(){this.max=this.high,null!==this.left&&(this.max=Math.max(this.max,this.left.max)),null!==this.right&&(this.max=Math.max(this.max,this.right.max))},n.prototype.getBalance=function(){var t=0;return null!==this.left&&null!==this.right?t=this.left.height-this.right.height:null!==this.left?t=this.left.height+1:null!==this.right&&(t=-(this.right.height+1)),t},n.prototype.isLeftChild=function(){return null!==this.parent&&this.parent.left===this},Object.defineProperty(n.prototype,"left",{get:function(){return this._left},set:function(t){this._left=t,null!==t&&(t.parent=this),this.updateHeight(),this.updateMax()}}),Object.defineProperty(n.prototype,"right",{get:function(){return this._right},set:function(t){this._right=t,null!==t&&(t.parent=this),this.updateHeight(),this.updateMax()}}),n.prototype.dispose=function(){this.parent=null,this._left=null,this._right=null,this.event=null},e.default=s.default.IntervalTimeline},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2);function n(t){return function(e,i){i=this.toSeconds(i),t.apply(this,arguments);var s=this._events.get(i),n=this._events.previousEvent(s),o=this._getTicksUntilEvent(n,i);return s.ticks=Math.max(o,0),this}}s.default.TickSignal=function(t){t=s.default.defaultArg(t,1),s.default.Signal.call(this,{units:s.default.Type.Ticks,value:t}),this._events.memory=1/0,this.cancelScheduledValues(0),this._events.add({type:s.default.Param.AutomationType.SetValue,time:0,value:t})},s.default.extend(s.default.TickSignal,s.default.Signal),s.default.TickSignal.prototype.setValueAtTime=n(s.default.Signal.prototype.setValueAtTime),s.default.TickSignal.prototype.linearRampToValueAtTime=n(s.default.Signal.prototype.linearRampToValueAtTime),s.default.TickSignal.prototype.setTargetAtTime=function(t,e,i){e=this.toSeconds(e),this.setRampPoint(e),t=this._fromUnits(t);for(var s=this._events.get(e),n=Math.round(Math.max(1/i,1)),o=0;o<=n;o++){var a=i*o+e,r=this._exponentialApproach(s.time,s.value,t,i,a);this.linearRampToValueAtTime(this._toUnits(r),a)}return this},s.default.TickSignal.prototype.exponentialRampToValueAtTime=function(t,e){e=this.toSeconds(e),t=this._fromUnits(t);for(var i=this._events.get(e),s=Math.round(Math.max(10*(e-i.time),1)),n=(e-i.time)/s,o=0;o<=s;o++){var a=n*o+i.time,r=this._exponentialInterpolate(i.time,i.value,e,t,a);this.linearRampToValueAtTime(this._toUnits(r),a)}return this},s.default.TickSignal.prototype._getTicksUntilEvent=function(t,e){if(null===t)t={ticks:0,time:0};else if(s.default.isUndef(t.ticks)){var i=this._events.previousEvent(t);t.ticks=this._getTicksUntilEvent(i,t.time)}var n=this.getValueAtTime(t.time),o=this.getValueAtTime(e);return this._events.get(e).time===e&&this._events.get(e).type===s.default.Param.AutomationType.SetValue&&(o=this.getValueAtTime(e-this.sampleTime)),.5*(e-t.time)*(n+o)+t.ticks},s.default.TickSignal.prototype.getTicksAtTime=function(t){t=this.toSeconds(t);var e=this._events.get(t);return Math.max(this._getTicksUntilEvent(e,t),0)},s.default.TickSignal.prototype.getDurationOfTicks=function(t,e){e=this.toSeconds(e);var i=this.getTicksAtTime(e);return this.getTimeOfTick(i+t)-e},s.default.TickSignal.prototype.getTimeOfTick=function(t){var e=this._events.get(t,"ticks"),i=this._events.getAfter(t,"ticks");if(e&&e.ticks===t)return e.time;if(e&&i&&i.type===s.default.Param.AutomationType.Linear&&e.value!==i.value){var n=this.getValueAtTime(e.time),o=(this.getValueAtTime(i.time)-n)/(i.time-e.time),a=Math.sqrt(Math.pow(n,2)-2*o*(e.ticks-t)),r=(-n+a)/o;return(r>0?r:(-n-a)/o)+e.time}return e?0===e.value?1/0:e.time+(t-e.ticks)/e.value:t/this._initialValue},s.default.TickSignal.prototype.ticksToTime=function(t,e){return e=this.toSeconds(e),new s.default.Time(this.getDurationOfTicks(t,e))},s.default.TickSignal.prototype.timeToTicks=function(t,e){e=this.toSeconds(e),t=this.toSeconds(t);var i=this.getTicksAtTime(e),n=this.getTicksAtTime(e+t);return new s.default.Ticks(n-i)},e.default=s.default.TickSignal},function(t,e,i){"use strict";i.r(e);var s=i(0);i(57),i(34),i(35),i(20);s.default.Clock=function(){var t=s.default.defaults(arguments,["callback","frequency"],s.default.Clock);s.default.Emitter.call(this),this.callback=t.callback,this._nextTick=0,this._tickSource=new s.default.TickSource(t.frequency),this._lastUpdate=0,this.frequency=this._tickSource.frequency,this._readOnly("frequency"),this._state=new s.default.TimelineState(s.default.State.Stopped),this._state.setStateAtTime(s.default.State.Stopped,0),this._boundLoop=this._loop.bind(this),this.context.on("tick",this._boundLoop)},s.default.extend(s.default.Clock,s.default.Emitter),s.default.Clock.defaults={callback:s.default.noOp,frequency:1},Object.defineProperty(s.default.Clock.prototype,"state",{get:function(){return this._state.getValueAtTime(this.now())}}),s.default.Clock.prototype.start=function(t,e){return this.context.resume(),t=this.toSeconds(t),this._state.getValueAtTime(t)!==s.default.State.Started&&(this._state.setStateAtTime(s.default.State.Started,t),this._tickSource.start(t,e),t<this._lastUpdate&&this.emit("start",t,e)),this},s.default.Clock.prototype.stop=function(t){return t=this.toSeconds(t),this._state.cancel(t),this._state.setStateAtTime(s.default.State.Stopped,t),this._tickSource.stop(t),t<this._lastUpdate&&this.emit("stop",t),this},s.default.Clock.prototype.pause=function(t){return t=this.toSeconds(t),this._state.getValueAtTime(t)===s.default.State.Started&&(this._state.setStateAtTime(s.default.State.Paused,t),this._tickSource.pause(t),t<this._lastUpdate&&this.emit("pause",t)),this},Object.defineProperty(s.default.Clock.prototype,"ticks",{get:function(){return Math.ceil(this.getTicksAtTime(this.now()))},set:function(t){this._tickSource.ticks=t}}),Object.defineProperty(s.default.Clock.prototype,"seconds",{get:function(){return this._tickSource.seconds},set:function(t){this._tickSource.seconds=t}}),s.default.Clock.prototype.getSecondsAtTime=function(t){return this._tickSource.getSecondsAtTime(t)},s.default.Clock.prototype.setTicksAtTime=function(t,e){return this._tickSource.setTicksAtTime(t,e),this},s.default.Clock.prototype.getTicksAtTime=function(t){return this._tickSource.getTicksAtTime(t)},s.default.Clock.prototype.nextTickTime=function(t,e){e=this.toSeconds(e);var i=this.getTicksAtTime(e);return this._tickSource.getTimeOfTick(i+t,e)},s.default.Clock.prototype._loop=function(){var t=this._lastUpdate,e=this.now();this._lastUpdate=e,t!==e&&(this._state.forEachBetween(t,e,function(t){switch(t.state){case s.default.State.Started:var e=this._tickSource.getTicksAtTime(t.time);this.emit("start",t.time,e);break;case s.default.State.Stopped:0!==t.time&&this.emit("stop",t.time);break;case s.default.State.Paused:this.emit("pause",t.time)}}.bind(this)),this._tickSource.forEachTickBetween(t,e,function(t,e){this.callback(t,e)}.bind(this)))},s.default.Clock.prototype.getStateAtTime=function(t){return t=this.toSeconds(t),this._state.getValueAtTime(t)},s.default.Clock.prototype.dispose=function(){s.default.Emitter.prototype.dispose.call(this),this.context.off("tick",this._boundLoop),this._writable("frequency"),this._tickSource.dispose(),this._tickSource=null,this.frequency=null,this._boundLoop=null,this._nextTick=1/0,this.callback=null,this._state.dispose(),this._state=null},e.default=s.default.Clock},function(t,e,i){"use strict";i.r(e);var s=i(0);i(2),i(5),i(7);s.default.GreaterThanZero=function(){s.default.SignalBase.call(this),this._thresh=this.output=new s.default.WaveShaper(function(t){return t<=0?0:1},127),this._scale=this.input=new s.default.Multiply(1e4),this._scale.connect(this._thresh)},s.default.extend(s.default.GreaterThanZero,s.default.SignalBase),s.default.GreaterThanZero.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._scale.dispose(),this._scale=null,this._thresh.dispose(),this._thresh=null,this},e.default=s.default.GreaterThanZero},function(t,e,i){"use strict";i.r(e);var s=i(0);i(84),i(13),i(2);s.default.GreaterThan=function(t){s.default.Signal.call(this),this.createInsOuts(2,0),this._param=this.input[0]=new s.default.Subtract(t),this.input[1]=this._param.input[1],this._gtz=this.output=new s.default.GreaterThanZero,this._param.connect(this._gtz)},s.default.extend(s.default.GreaterThan,s.default.Signal),s.default.GreaterThan.prototype.dispose=function(){return s.default.Signal.prototype.dispose.call(this),this._gtz.dispose(),this._gtz=null,this},e.default=s.default.GreaterThan},function(t,e,i){"use strict";i.r(e);var s=i(0);i(47),i(26);s.default.ScaledEnvelope=function(){var t=s.default.defaults(arguments,["attack","decay","sustain","release"],s.default.Envelope);s.default.Envelope.call(this,t),t=s.default.defaultArg(t,s.default.ScaledEnvelope.defaults),this._exp=this.output=new s.default.Pow(t.exponent),this._scale=this.output=new s.default.Scale(t.min,t.max),this._sig.chain(this._exp,this._scale)},s.default.extend(s.default.ScaledEnvelope,s.default.Envelope),s.default.ScaledEnvelope.defaults={min:0,max:1,exponent:1},Object.defineProperty(s.default.ScaledEnvelope.prototype,"min",{get:function(){return this._scale.min},set:function(t){this._scale.min=t}}),Object.defineProperty(s.default.ScaledEnvelope.prototype,"max",{get:function(){return this._scale.max},set:function(t){this._scale.max=t}}),Object.defineProperty(s.default.ScaledEnvelope.prototype,"exponent",{get:function(){return this._exp.value},set:function(t){this._exp.value=t}}),s.default.ScaledEnvelope.prototype.dispose=function(){return s.default.Envelope.prototype.dispose.call(this),this._scale.dispose(),this._scale=null,this._exp.dispose(),this._exp=null,this},e.default=s.default.ScaledEnvelope},function(t,e,i){"use strict";i.r(e);var s=i(0);i(7),i(30);s.default.Abs=function(){s.default.SignalBase.call(this),this._abs=this.input=this.output=new s.default.WaveShaper(function(t){return Math.abs(t)<.001?0:Math.abs(t)},1024)},s.default.extend(s.default.Abs,s.default.SignalBase),s.default.Abs.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._abs.dispose(),this._abs=null,this},e.default=s.default.Abs},function(t,e,i){"use strict";i.r(e);var s=i(0);i(3),i(1);s.default.Solo=function(){var t=s.default.defaults(arguments,["solo"],s.default.Solo);s.default.AudioNode.call(this),this.input=this.output=new s.default.Gain,this._soloBind=this._soloed.bind(this),this.context.on("solo",this._soloBind),this.solo=t.solo},s.default.extend(s.default.Solo,s.default.AudioNode),s.default.Solo.defaults={solo:!1},Object.defineProperty(s.default.Solo.prototype,"solo",{get:function(){return this._isSoloed()},set:function(t){t?this._addSolo():this._removeSolo(),this.context.emit("solo",this)}}),Object.defineProperty(s.default.Solo.prototype,"muted",{get:function(){return 0===this.input.gain.value}}),s.default.Solo.prototype._addSolo=function(){s.default.isArray(this.context._currentSolo)||(this.context._currentSolo=[]),this._isSoloed()||this.context._currentSolo.push(this)},s.default.Solo.prototype._removeSolo=function(){if(this._isSoloed()){var t=this.context._currentSolo.indexOf(this);this.context._currentSolo.splice(t,1)}},s.default.Solo.prototype._isSoloed=function(){return!!s.default.isArray(this.context._currentSolo)&&(0!==this.context._currentSolo.length&&-1!==this.context._currentSolo.indexOf(this))},s.default.Solo.prototype._noSolos=function(){return!s.default.isArray(this.context._currentSolo)||0===this.context._currentSolo.length},s.default.Solo.prototype._soloed=function(){this._isSoloed()?this.input.gain.value=1:this._noSolos()?this.input.gain.value=1:this.input.gain.value=0},s.default.Solo.prototype.dispose=function(){return this.context.off("solo",this._soloBind),this._removeSolo(),this._soloBind=null,s.default.AudioNode.prototype.dispose.call(this),this},e.default=s.default.Solo},function(t,e,i){"use strict";i.r(e);var s=i(0);i(7);s.default.EqualPowerGain=function(){s.default.SignalBase.call(this),this._eqPower=this.input=this.output=new s.default.WaveShaper(function(t){return Math.abs(t)<.001?0:s.default.equalPowerScale(t)}.bind(this),4096)},s.default.extend(s.default.EqualPowerGain,s.default.SignalBase),s.default.EqualPowerGain.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._eqPower.dispose(),this._eqPower=null,this},e.default=s.default.EqualPowerGain},function(t,e,i){"use strict";i.r(e);var s=i(0);i(5),i(2);s.default.Negate=function(){s.default.SignalBase.call(this),this._multiply=this.input=this.output=new s.default.Multiply(-1)},s.default.extend(s.default.Negate,s.default.SignalBase),s.default.Negate.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._multiply.dispose(),this._multiply=null,this},e.default=s.default.Negate},function(t,e,i){"use strict";i.r(e);var s=i(0);i(48),i(27),i(1);s.default.PanVol=function(){var t=s.default.defaults(arguments,["pan","volume"],s.default.PanVol);s.default.AudioNode.call(this),this._panner=this.input=new s.default.Panner(t.pan),this.pan=this._panner.pan,this._volume=this.output=new s.default.Volume(t.volume),this.volume=this._volume.volume,this._panner.connect(this._volume),this.mute=t.mute,this._readOnly(["pan","volume"])},s.default.extend(s.default.PanVol,s.default.AudioNode),s.default.PanVol.defaults={pan:0,volume:0,mute:!1},Object.defineProperty(s.default.PanVol.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t}}),s.default.PanVol.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["pan","volume"]),this._panner.dispose(),this._panner=null,this.pan=null,this._volume.dispose(),this._volume=null,this.volume=null,this},e.default=s.default.PanVol},function(t,e,i){"use strict";var s=i(0);if(s.default.supported){!s.default.global.hasOwnProperty("OfflineAudioContext")&&s.default.global.hasOwnProperty("webkitOfflineAudioContext")&&(s.default.global.OfflineAudioContext=s.default.global.webkitOfflineAudioContext);var n=new OfflineAudioContext(1,1,44100).startRendering();n&&s.default.isFunction(n.then)||(OfflineAudioContext.prototype._native_startRendering=OfflineAudioContext.prototype.startRendering,OfflineAudioContext.prototype.startRendering=function(){return new Promise(function(t){this.oncomplete=function(e){t(e.renderedBuffer)},this._native_startRendering()}.bind(this))})}},function(t,e,i){"use strict";e.a="13.8.25"},function(t,e,i){"use strict";i.r(e);var s=i(0);i(46);s.default.Midi=function(t,e){if(!(this instanceof s.default.Midi))return new s.default.Midi(t,e);s.default.Frequency.call(this,t,e)},s.default.extend(s.default.Midi,s.default.Frequency),s.default.Midi.prototype._defaultUnits="midi",s.default.Midi.prototype._frequencyToUnits=function(t){return s.default.Frequency.ftom(s.default.Frequency.prototype._frequencyToUnits.call(this,t))},s.default.Midi.prototype._ticksToUnits=function(t){return s.default.Frequency.ftom(s.default.Frequency.prototype._ticksToUnits.call(this,t))},s.default.Midi.prototype._beatsToUnits=function(t){return s.default.Frequency.ftom(s.default.Frequency.prototype._beatsToUnits.call(this,t))},s.default.Midi.prototype._secondsToUnits=function(t){return s.default.Frequency.ftom(s.default.Frequency.prototype._secondsToUnits.call(this,t))},s.default.Midi.prototype.toMidi=function(){return this.valueOf()},s.default.Midi.prototype.toFrequency=function(){return s.default.Frequency.mtof(this.toMidi())},s.default.Midi.prototype.transpose=function(t){return new this.constructor(this.toMidi()+t)},e.default=s.default.Midi},function(t,e,i){"use strict";i.r(e);var s=i(0);i(27),i(1);s.default.UserMedia=function(){var t=s.default.defaults(arguments,["volume"],s.default.UserMedia);s.default.AudioNode.call(this),this._mediaStream=null,this._stream=null,this._device=null,this._volume=this.output=new s.default.Volume(t.volume),this.volume=this._volume.volume,this._readOnly("volume"),this.mute=t.mute},s.default.extend(s.default.UserMedia,s.default.AudioNode),s.default.UserMedia.defaults={volume:0,mute:!1},s.default.UserMedia.prototype.open=function(t){return this.state===s.default.State.Started&&this.close(),s.default.UserMedia.enumerateDevices().then(function(e){var i;if(s.default.isNumber(t))i=e[t];else if(!(i=e.find(function(e){return e.label===t||e.deviceId===t}))&&e.length>0)i=e[0];else if(!i&&s.default.isDefined(t))throw new Error("Tone.UserMedia: no matching device: "+t);this._device=i;var n={audio:{echoCancellation:!1,sampleRate:this.context.sampleRate,noiseSuppression:!1,mozNoiseSuppression:!1}};return i&&(n.audio.deviceId=i.deviceId),navigator.mediaDevices.getUserMedia(n).then(function(t){return this._stream||(this._stream=t,this._mediaStream=this.context.createMediaStreamSource(t),s.default.connect(this._mediaStream,this.output)),this}.bind(this))}.bind(this))},s.default.UserMedia.prototype.close=function(){return this._stream&&(this._stream.getAudioTracks().forEach(function(t){t.stop()}),this._stream=null,this._mediaStream.disconnect(),this._mediaStream=null),this._device=null,this},s.default.UserMedia.enumerateDevices=function(){return navigator.mediaDevices.enumerateDevices().then(function(t){return t.filter(function(t){return"audioinput"===t.kind})})},Object.defineProperty(s.default.UserMedia.prototype,"state",{get:function(){return this._stream&&this._stream.active?s.default.State.Started:s.default.State.Stopped}}),Object.defineProperty(s.default.UserMedia.prototype,"deviceId",{get:function(){return this._device?this._device.deviceId:null}}),Object.defineProperty(s.default.UserMedia.prototype,"groupId",{get:function(){return this._device?this._device.groupId:null}}),Object.defineProperty(s.default.UserMedia.prototype,"label",{get:function(){return this._device?this._device.label:null}}),Object.defineProperty(s.default.UserMedia.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t}}),s.default.UserMedia.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this.close(),this._writable("volume"),this._volume.dispose(),this._volume=null,this.volume=null,this},Object.defineProperty(s.default.UserMedia,"supported",{get:function(){return s.default.isDefined(navigator.mediaDevices)&&s.default.isFunction(navigator.mediaDevices.getUserMedia)}}),e.default=s.default.UserMedia},function(t,e,i){"use strict";i.r(e);var s=i(0);i(65),i(27),i(1);s.default.Players=function(t){var e=Array.prototype.slice.call(arguments);e.shift();var i=s.default.defaults(e,["onload"],s.default.Players);for(var n in s.default.AudioNode.call(this,i),this._volume=this.output=new s.default.Volume(i.volume),this.volume=this._volume.volume,this._readOnly("volume"),this._volume.output.output.channelCount=2,this._volume.output.output.channelCountMode="explicit",this.mute=i.mute,this._players={},this._loadingCount=0,this._fadeIn=i.fadeIn,this._fadeOut=i.fadeOut,t)this._loadingCount++,this.add(n,t[n],this._bufferLoaded.bind(this,i.onload))},s.default.extend(s.default.Players,s.default.AudioNode),s.default.Players.defaults={volume:0,mute:!1,onload:s.default.noOp,fadeIn:0,fadeOut:0},s.default.Players.prototype._bufferLoaded=function(t){this._loadingCount--,0===this._loadingCount&&t&&t(this)},Object.defineProperty(s.default.Players.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t}}),Object.defineProperty(s.default.Players.prototype,"fadeIn",{get:function(){return this._fadeIn},set:function(t){this._fadeIn=t,this._forEach(function(e){e.fadeIn=t})}}),Object.defineProperty(s.default.Players.prototype,"fadeOut",{get:function(){return this._fadeOut},set:function(t){this._fadeOut=t,this._forEach(function(e){e.fadeOut=t})}}),Object.defineProperty(s.default.Players.prototype,"state",{get:function(){var t=!1;return this._forEach(function(e){t=t||e.state===s.default.State.Started}),t?s.default.State.Started:s.default.State.Stopped}}),s.default.Players.prototype.has=function(t){return this._players.hasOwnProperty(t)},s.default.Players.prototype.get=function(t){if(this.has(t))return this._players[t];throw new Error("Tone.Players: no player named "+t)},s.default.Players.prototype._forEach=function(t){for(var e in this._players)t(this._players[e],e);return this},Object.defineProperty(s.default.Players.prototype,"loaded",{get:function(){var t=!0;return this._forEach(function(e){t=t&&e.loaded}),t}}),s.default.Players.prototype.add=function(t,e,i){return this._players[t]=new s.default.Player(e,i).connect(this.output),this._players[t].fadeIn=this._fadeIn,this._players[t].fadeOut=this._fadeOut,this},s.default.Players.prototype.stopAll=function(t){this._forEach(function(e){e.stop(t)})},s.default.Players.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._volume.dispose(),this._volume=null,this._writable("volume"),this.volume=null,this.output=null,this._forEach(function(t){t.dispose()}),this._players=null,this},e.default=s.default.Players},function(t,e,i){"use strict";i.r(e);var s=i(0);i(6),i(11),i(32);s.default.GrainPlayer=function(){var t=s.default.defaults(arguments,["url","onload"],s.default.GrainPlayer);s.default.Source.call(this,t),this.buffer=new s.default.Buffer(t.url,t.onload.bind(void 0,this)),this._clock=new s.default.Clock(this._tick.bind(this),t.grainSize),this._loopStart=0,this._loopEnd=0,this._activeSources=[],this._playbackRate=t.playbackRate,this._grainSize=t.grainSize,this._overlap=t.overlap,this.detune=t.detune,this.overlap=t.overlap,this.loop=t.loop,this.playbackRate=t.playbackRate,this.grainSize=t.grainSize,this.loopStart=t.loopStart,this.loopEnd=t.loopEnd,this.reverse=t.reverse,this._clock.on("stop",this._onstop.bind(this))},s.default.extend(s.default.GrainPlayer,s.default.Source),s.default.GrainPlayer.defaults={onload:s.default.noOp,overlap:.1,grainSize:.2,playbackRate:1,detune:0,loop:!1,loopStart:0,loopEnd:0,reverse:!1},s.default.GrainPlayer.prototype._start=function(t,e,i){e=s.default.defaultArg(e,0),e=this.toSeconds(e),t=this.toSeconds(t),this._offset=e,this._clock.start(t),i&&this.stop(t+this.toSeconds(i))},s.default.GrainPlayer.prototype._stop=function(t){this._clock.stop(t)},s.default.GrainPlayer.prototype._onstop=function(t){this._activeSources.forEach(function(e){e.fadeOut=0,e.stop(t)})},s.default.GrainPlayer.prototype._tick=function(t){if(!this.loop&&this._offset>this.buffer.duration)this.stop(t);else{var e=this._offset<this._overlap?0:this._overlap,i=new s.default.BufferSource({buffer:this.buffer,fadeIn:e,fadeOut:this._overlap,loop:this.loop,loopStart:this._loopStart,loopEnd:this._loopEnd,playbackRate:s.default.intervalToFrequencyRatio(this.detune/100)}).connect(this.output);i.start(t,this._offset),this._offset+=this.grainSize,i.stop(t+this.grainSize/this.playbackRate),this._activeSources.push(i),i.onended=function(){var t=this._activeSources.indexOf(i);-1!==t&&this._activeSources.splice(t,1)}.bind(this)}},Object.defineProperty(s.default.GrainPlayer.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t,this.grainSize=this._grainSize}}),Object.defineProperty(s.default.GrainPlayer.prototype,"loopStart",{get:function(){return this._loopStart},set:function(t){this._loopStart=this.toSeconds(t)}}),Object.defineProperty(s.default.GrainPlayer.prototype,"loopEnd",{get:function(){return this._loopEnd},set:function(t){this._loopEnd=this.toSeconds(t)}}),Object.defineProperty(s.default.GrainPlayer.prototype,"reverse",{get:function(){return this.buffer.reverse},set:function(t){this.buffer.reverse=t}}),Object.defineProperty(s.default.GrainPlayer.prototype,"grainSize",{get:function(){return this._grainSize},set:function(t){this._grainSize=this.toSeconds(t),this._clock.frequency.value=this._playbackRate/this._grainSize}}),Object.defineProperty(s.default.GrainPlayer.prototype,"overlap",{get:function(){return this._overlap},set:function(t){this._overlap=this.toSeconds(t)}}),Object.defineProperty(s.default.GrainPlayer.prototype,"loaded",{get:function(){return this.buffer.loaded}}),s.default.GrainPlayer.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this.buffer.dispose(),this.buffer=null,this._clock.dispose(),this._clock=null,this._activeSources.forEach(function(t){t.dispose()}),this._activeSources=null,this},e.default=s.default.GrainPlayer},function(t,e,i){"use strict";i.r(e);var s=i(0);i(16),i(2),i(45);s.default.TransportTimelineSignal=function(){s.default.Signal.apply(this,arguments),this.output=this._outputSig=new s.default.Signal(this._initialValue),this._lastVal=this.value,this._synced=s.default.Transport.scheduleRepeat(this._onTick.bind(this),"1i"),this._bindAnchorValue=this._anchorValue.bind(this),s.default.Transport.on("start stop pause",this._bindAnchorValue),this._events.memory=1/0},s.default.extend(s.default.TransportTimelineSignal,s.default.Signal),s.default.TransportTimelineSignal.prototype._onTick=function(t){var e=this.getValueAtTime(s.default.Transport.seconds);this._lastVal!==e&&(this._lastVal=e,this._outputSig.linearRampToValueAtTime(e,t))},s.default.TransportTimelineSignal.prototype._anchorValue=function(t){var e=this.getValueAtTime(s.default.Transport.seconds);return this._lastVal=e,this._outputSig.cancelScheduledValues(t),this._outputSig.setValueAtTime(e,t),this},s.default.TransportTimelineSignal.prototype.getValueAtTime=function(t){return t=s.default.TransportTime(t),s.default.Signal.prototype.getValueAtTime.call(this,t)},s.default.TransportTimelineSignal.prototype.setValueAtTime=function(t,e){return e=s.default.TransportTime(e),s.default.Signal.prototype.setValueAtTime.call(this,t,e),this},s.default.TransportTimelineSignal.prototype.linearRampToValueAtTime=function(t,e){return e=s.default.TransportTime(e),s.default.Signal.prototype.linearRampToValueAtTime.call(this,t,e),this},s.default.TransportTimelineSignal.prototype.exponentialRampToValueAtTime=function(t,e){return e=s.default.TransportTime(e),s.default.Signal.prototype.exponentialRampToValueAtTime.call(this,t,e),this},s.default.TransportTimelineSignal.prototype.setTargetAtTime=function(t,e,i){return e=s.default.TransportTime(e),s.default.Signal.prototype.setTargetAtTime.call(this,t,e,i),this},s.default.TransportTimelineSignal.prototype.cancelScheduledValues=function(t){return t=s.default.TransportTime(t),s.default.Signal.prototype.cancelScheduledValues.call(this,t),this},s.default.TransportTimelineSignal.prototype.setValueCurveAtTime=function(t,e,i,n){return e=s.default.TransportTime(e),i=s.default.TransportTime(i),s.default.Signal.prototype.setValueCurveAtTime.call(this,t,e,i,n),this},s.default.TransportTimelineSignal.prototype.cancelAndHoldAtTime=function(t){return s.default.Signal.prototype.cancelAndHoldAtTime.call(this,s.default.TransportTime(t))},s.default.TransportTimelineSignal.prototype.dispose=function(){s.default.Transport.clear(this._synced),s.default.Transport.off("start stop pause",this._syncedCallback),this._events.cancel(0),s.default.Signal.prototype.dispose.call(this),this._outputSig.dispose(),this._outputSig=null},e.default=s.default.TransportTimelineSignal},function(t,e,i){"use strict";i.r(e);var s=i(0);i(29),i(5);s.default.Normalize=function(t,e){s.default.SignalBase.call(this),this._inputMin=s.default.defaultArg(t,0),this._inputMax=s.default.defaultArg(e,1),this._sub=this.input=new s.default.Add(0),this._div=this.output=new s.default.Multiply(1),this._sub.connect(this._div),this._setRange()},s.default.extend(s.default.Normalize,s.default.SignalBase),Object.defineProperty(s.default.Normalize.prototype,"min",{get:function(){return this._inputMin},set:function(t){this._inputMin=t,this._setRange()}}),Object.defineProperty(s.default.Normalize.prototype,"max",{get:function(){return this._inputMax},set:function(t){this._inputMax=t,this._setRange()}}),s.default.Normalize.prototype._setRange=function(){this._sub.value=-this._inputMin,this._div.value=1/(this._inputMax-this._inputMin)},s.default.Normalize.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._sub.dispose(),this._sub=null,this._div.dispose(),this._div=null,this},e.default=s.default.Normalize},function(t,e,i){"use strict";i.r(e);var s=i(0);i(7),i(2);s.default.GainToAudio=function(){s.default.SignalBase.call(this),this._norm=this.input=this.output=new s.default.WaveShaper(function(t){return 2*Math.abs(t)-1})},s.default.extend(s.default.GainToAudio,s.default.SignalBase),s.default.GainToAudio.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._norm.dispose(),this._norm=null,this},e.default=s.default.GainToAudio},function(t,e,i){"use strict";i.r(e);var s=i(0);i(21),i(78),i(32);s.default.Sampler=function(t){var e=Array.prototype.slice.call(arguments);e.shift();var i=s.default.defaults(e,["onload","baseUrl"],s.default.Sampler);s.default.Instrument.call(this,i);var n={};for(var o in t)if(s.default.isNote(o)){n[s.default.Frequency(o).toMidi()]=t[o]}else{if(isNaN(parseFloat(o)))throw new Error("Tone.Sampler: url keys must be the note's pitch");n[o]=t[o]}this._buffers=new s.default.Buffers(n,i.onload,i.baseUrl),this._activeSources={},this.attack=i.attack,this.release=i.release,this.curve=i.curve},s.default.extend(s.default.Sampler,s.default.Instrument),s.default.Sampler.defaults={attack:0,release:.1,onload:s.default.noOp,baseUrl:"",curve:"exponential"},s.default.Sampler.prototype._findClosest=function(t){for(var e=0;e<96;){if(this._buffers.has(t+e))return-e;if(this._buffers.has(t-e))return e;e++}throw new Error("No available buffers for note: "+t)},s.default.Sampler.prototype.triggerAttack=function(t,e,i){this.log("triggerAttack",t,e,i),Array.isArray(t)||(t=[t]);for(var n=0;n<t.length;n++){var o=s.default.Frequency(t[n]).toMidi(),a=this._findClosest(o),r=o-a,l=this._buffers.get(r),u=s.default.intervalToFrequencyRatio(a),d=new s.default.BufferSource({buffer:l,playbackRate:u,fadeIn:this.attack,fadeOut:this.release,curve:this.curve}).connect(this.output);d.start(e,0,l.duration/u,i),s.default.isArray(this._activeSources[o])||(this._activeSources[o]=[]),this._activeSources[o].push(d),d.onended=function(){if(this._activeSources&&this._activeSources[o]){var t=this._activeSources[o].indexOf(d);-1!==t&&this._activeSources[o].splice(t,1)}}.bind(this)}return this},s.default.Sampler.prototype.triggerRelease=function(t,e){this.log("triggerRelease",t,e),Array.isArray(t)||(t=[t]);for(var i=0;i<t.length;i++){var n=s.default.Frequency(t[i]).toMidi();this._activeSources[n]&&this._activeSources[n].length&&(e=this.toSeconds(e),this._activeSources[n].forEach(function(t){t.stop(e)}),this._activeSources[n]=[])}return this},s.default.Sampler.prototype.releaseAll=function(t){for(var e in t=this.toSeconds(t),this._activeSources)for(var i=this._activeSources[e];i.length;){i.shift().stop(t)}return this},s.default.Sampler.prototype.sync=function(){return this._syncMethod("triggerAttack",1),this._syncMethod("triggerRelease",1),this},s.default.Sampler.prototype.triggerAttackRelease=function(t,e,i,n){if(i=this.toSeconds(i),this.triggerAttack(t,i,n),s.default.isArray(e)&&s.default.isArray(t))for(var o=0;o<t.length;o++){var a=e[Math.min(o,e.length-1)];this.triggerRelease(t[o],i+this.toSeconds(a))}else this.triggerRelease(t,i+this.toSeconds(e));return this},s.default.Sampler.prototype.add=function(t,e,i){if(s.default.isNote(t)){var n=s.default.Frequency(t).toMidi();this._buffers.add(n,e,i)}else{if(isNaN(parseFloat(t)))throw new Error("Tone.Sampler: note must be the note's pitch. Instead got "+t);this._buffers.add(t,e,i)}},Object.defineProperty(s.default.Sampler.prototype,"loaded",{get:function(){return this._buffers.loaded}}),s.default.Sampler.prototype.dispose=function(){for(var t in s.default.Instrument.prototype.dispose.call(this),this._buffers.dispose(),this._buffers=null,this._activeSources)this._activeSources[t].forEach(function(t){t.dispose()});return this._activeSources=null,this},e.default=s.default.Sampler},function(t,e,i){"use strict";i.r(e);var s=i(0);i(38),i(6);s.default.PolySynth=function(){var t=s.default.defaults(arguments,["polyphony","voice"],s.default.PolySynth);s.default.Instrument.call(this,t),(t=s.default.defaultArg(t,s.default.Instrument.defaults)).polyphony=Math.min(s.default.PolySynth.MAX_POLYPHONY,t.polyphony),this.voices=new Array(t.polyphony),this.assert(t.polyphony>0,"polyphony must be greater than 0"),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this._readOnly("detune");for(var e=0;e<t.polyphony;e++){var i=new t.voice(arguments[2],arguments[3]);if(!(i instanceof s.default.Monophonic))throw new Error("Synth constructor must be instance of Tone.Monophonic");this.voices[e]=i,i.index=e,i.connect(this.output),i.hasOwnProperty("detune")&&this.detune.connect(i.detune)}},s.default.extend(s.default.PolySynth,s.default.Instrument),s.default.PolySynth.defaults={polyphony:4,volume:0,detune:0,voice:s.default.Synth},s.default.PolySynth.prototype._getClosestVoice=function(t,e){var i=this.voices.find(function(i){if(Math.abs(i.frequency.getValueAtTime(t)-s.default.Frequency(e))<1e-4&&i.getLevelAtTime(t)>1e-5)return i});return i||this.voices.slice().sort(function(e,i){var s=e.getLevelAtTime(t+this.blockTime),n=i.getLevelAtTime(t+this.blockTime);return s<1e-5&&(s=0),n<1e-5&&(n=0),s-n}.bind(this))[0]},s.default.PolySynth.prototype.triggerAttack=function(t,e,i){return Array.isArray(t)||(t=[t]),e=this.toSeconds(e),t.forEach(function(t){var s=this._getClosestVoice(e,t);s.triggerAttack(t,e,i),this.log("triggerAttack",s.index,t)}.bind(this)),this},s.default.PolySynth.prototype.triggerRelease=function(t,e){return Array.isArray(t)||(t=[t]),e=this.toSeconds(e),t.forEach(function(t){var i=this._getClosestVoice(e,t);this.log("triggerRelease",i.index,t),i.triggerRelease(e)}.bind(this)),this},s.default.PolySynth.prototype.triggerAttackRelease=function(t,e,i,n){if(i=this.toSeconds(i),this.triggerAttack(t,i,n),s.default.isArray(e)&&s.default.isArray(t))for(var o=0;o<t.length;o++){var a=e[Math.min(o,e.length-1)];this.triggerRelease(t[o],i+this.toSeconds(a))}else this.triggerRelease(t,i+this.toSeconds(e));return this},s.default.PolySynth.prototype.sync=function(){return this._syncMethod("triggerAttack",1),this._syncMethod("triggerRelease",1),this},s.default.PolySynth.prototype.set=function(t,e,i){for(var s=0;s<this.voices.length;s++)this.voices[s].set(t,e,i);return this},s.default.PolySynth.prototype.get=function(t){return this.voices[0].get(t)},s.default.PolySynth.prototype.releaseAll=function(t){return t=this.toSeconds(t),this.voices.forEach(function(e){e.triggerRelease(t)}),this},s.default.PolySynth.prototype.dispose=function(){return s.default.Instrument.prototype.dispose.call(this),this.voices.forEach(function(t){t.dispose()}),this._writable("detune"),this.detune.dispose(),this.detune=null,this.voices=null,this},s.default.PolySynth.MAX_POLYPHONY=20,e.default=s.default.PolySynth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(21),i(39),i(54);s.default.PluckSynth=function(t){t=s.default.defaultArg(t,s.default.PluckSynth.defaults),s.default.Instrument.call(this,t),this._noise=new s.default.Noise("pink"),this.attackNoise=t.attackNoise,this._lfcf=new s.default.LowpassCombFilter({resonance:t.resonance,dampening:t.dampening}),this.resonance=this._lfcf.resonance,this.dampening=this._lfcf.dampening,this._noise.connect(this._lfcf),this._lfcf.connect(this.output),this._readOnly(["resonance","dampening"])},s.default.extend(s.default.PluckSynth,s.default.Instrument),s.default.PluckSynth.defaults={attackNoise:1,dampening:4e3,resonance:.7},s.default.PluckSynth.prototype.triggerAttack=function(t,e){t=this.toFrequency(t),e=this.toSeconds(e);var i=1/t;return this._lfcf.delayTime.setValueAtTime(i,e),this._noise.start(e),this._noise.stop(e+i*this.attackNoise),this},s.default.PluckSynth.prototype.dispose=function(){return s.default.Instrument.prototype.dispose.call(this),this._noise.dispose(),this._lfcf.dispose(),this._noise=null,this._lfcf=null,this._writable(["resonance","dampening"]),this.dampening=null,this.resonance=null,this},e.default=s.default.PluckSynth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(31),i(41),i(39),i(2),i(9),i(21);s.default.NoiseSynth=function(t){t=s.default.defaultArg(t,s.default.NoiseSynth.defaults),s.default.Instrument.call(this,t),this.noise=new s.default.Noise(t.noise),this.envelope=new s.default.AmplitudeEnvelope(t.envelope),this.noise.chain(this.envelope,this.output),this._readOnly(["noise","envelope"])},s.default.extend(s.default.NoiseSynth,s.default.Instrument),s.default.NoiseSynth.defaults={noise:{type:"white"},envelope:{attack:.005,decay:.1,sustain:0}},s.default.NoiseSynth.prototype.triggerAttack=function(t,e){return t=this.toSeconds(t),this.envelope.triggerAttack(t,e),this.noise.start(t),0===this.envelope.sustain&&this.noise.stop(t+this.envelope.attack+this.envelope.decay),this},s.default.NoiseSynth.prototype.triggerRelease=function(t){return t=this.toSeconds(t),this.envelope.triggerRelease(t),this.noise.stop(t+this.envelope.release),this},s.default.NoiseSynth.prototype.sync=function(){return this._syncMethod("triggerAttack",0),this._syncMethod("triggerRelease",0),this},s.default.NoiseSynth.prototype.triggerAttackRelease=function(t,e,i){return e=this.toSeconds(e),t=this.toSeconds(t),this.triggerAttack(e,i),this.triggerRelease(e+t),this},s.default.NoiseSynth.prototype.dispose=function(){return s.default.Instrument.prototype.dispose.call(this),this._writable(["noise","envelope"]),this.noise.dispose(),this.noise=null,this.envelope.dispose(),this.envelope=null,this},e.default=s.default.NoiseSynth},function(t,e,i){"use strict";i.r(e);var s=i(0),n=(i(21),i(49),i(9),i(41),i(31),i(3),i(26),i(5),[1,1.483,1.932,2.546,2.63,3.897]);s.default.MetalSynth=function(t){t=s.default.defaultArg(t,s.default.MetalSynth.defaults),s.default.Instrument.call(this,t),this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this._oscillators=[],this._freqMultipliers=[],this._amplitue=new s.default.Gain(0).connect(this.output),this._highpass=new s.default.Filter({type:"highpass",Q:-3.0102999566398125}).connect(this._amplitue),this._octaves=t.octaves,this._filterFreqScaler=new s.default.Scale(t.resonance,7e3),this.envelope=new s.default.Envelope({attack:t.envelope.attack,attackCurve:"linear",decay:t.envelope.decay,sustain:0,release:t.envelope.release}).chain(this._filterFreqScaler,this._highpass.frequency),this.envelope.connect(this._amplitue.gain);for(var e=0;e<n.length;e++){var i=new s.default.FMOscillator({type:"square",modulationType:"square",harmonicity:t.harmonicity,modulationIndex:t.modulationIndex});i.connect(this._highpass),this._oscillators[e]=i;var o=new s.default.Multiply(n[e]);this._freqMultipliers[e]=o,this.frequency.chain(o,i.frequency)}this.octaves=t.octaves},s.default.extend(s.default.MetalSynth,s.default.Instrument),s.default.MetalSynth.defaults={frequency:200,envelope:{attack:.001,decay:1.4,release:.2},harmonicity:5.1,modulationIndex:32,resonance:4e3,octaves:1.5},s.default.MetalSynth.prototype.triggerAttack=function(t,e){return t=this.toSeconds(t),e=s.default.defaultArg(e,1),this.envelope.triggerAttack(t,e),this._oscillators.forEach(function(e){e.start(t)}),0===this.envelope.sustain&&this._oscillators.forEach(function(e){e.stop(t+this.envelope.attack+this.envelope.decay)}.bind(this)),this},s.default.MetalSynth.prototype.triggerRelease=function(t){return t=this.toSeconds(t),this.envelope.triggerRelease(t),this._oscillators.forEach(function(e){e.stop(t+this.envelope.release)}.bind(this)),this},s.default.MetalSynth.prototype.sync=function(){return this._syncMethod("triggerAttack",0),this._syncMethod("triggerRelease",0),this},s.default.MetalSynth.prototype.triggerAttackRelease=function(t,e,i){return e=this.toSeconds(e),t=this.toSeconds(t),this.triggerAttack(e,i),this.triggerRelease(e+t),this},Object.defineProperty(s.default.MetalSynth.prototype,"modulationIndex",{get:function(){return this._oscillators[0].modulationIndex.value},set:function(t){for(var e=0;e<this._oscillators.length;e++)this._oscillators[e].modulationIndex.value=t}}),Object.defineProperty(s.default.MetalSynth.prototype,"harmonicity",{get:function(){return this._oscillators[0].harmonicity.value},set:function(t){for(var e=0;e<this._oscillators.length;e++)this._oscillators[e].harmonicity.value=t}}),Object.defineProperty(s.default.MetalSynth.prototype,"resonance",{get:function(){return this._filterFreqScaler.min},set:function(t){this._filterFreqScaler.min=t,this.octaves=this._octaves}}),Object.defineProperty(s.default.MetalSynth.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t,this._filterFreqScaler.max=this._filterFreqScaler.min*Math.pow(2,t)}}),s.default.MetalSynth.prototype.dispose=function(){s.default.Instrument.prototype.dispose.call(this);for(var t=0;t<this._oscillators.length;t++)this._oscillators[t].dispose(),this._freqMultipliers[t].dispose();this._oscillators=null,this._freqMultipliers=null,this.frequency.dispose(),this.frequency=null,this._filterFreqScaler.dispose(),this._filterFreqScaler=null,this._amplitue.dispose(),this._amplitue=null,this.envelope.dispose(),this.envelope=null,this._highpass.dispose(),this._highpass=null},e.default=s.default.MetalSynth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(37),i(21),i(31);s.default.MembraneSynth=function(t){t=s.default.defaultArg(t,s.default.MembraneSynth.defaults),s.default.Instrument.call(this,t),this.oscillator=new s.default.OmniOscillator(t.oscillator),this.envelope=new s.default.AmplitudeEnvelope(t.envelope),this.octaves=t.octaves,this.pitchDecay=t.pitchDecay,this.oscillator.chain(this.envelope,this.output),this._readOnly(["oscillator","envelope"])},s.default.extend(s.default.MembraneSynth,s.default.Instrument),s.default.MembraneSynth.defaults={pitchDecay:.05,octaves:10,oscillator:{type:"sine"},envelope:{attack:.001,decay:.4,sustain:.01,release:1.4,attackCurve:"exponential"}},s.default.MembraneSynth.prototype.triggerAttack=function(t,e,i){e=this.toSeconds(e);var s=(t=this.toFrequency(t))*this.octaves;return this.oscillator.frequency.setValueAtTime(s,e),this.oscillator.frequency.exponentialRampToValueAtTime(t,e+this.toSeconds(this.pitchDecay)),this.envelope.triggerAttack(e,i),this.oscillator.start(e),0===this.envelope.sustain&&this.oscillator.stop(e+this.envelope.attack+this.envelope.decay),this},s.default.MembraneSynth.prototype.triggerRelease=function(t){return t=this.toSeconds(t),this.envelope.triggerRelease(t),this.oscillator.stop(t+this.envelope.release),this},s.default.MembraneSynth.prototype.dispose=function(){return s.default.Instrument.prototype.dispose.call(this),this._writable(["oscillator","envelope"]),this.oscillator.dispose(),this.oscillator=null,this.envelope.dispose(),this.envelope=null,this},e.default=s.default.MembraneSynth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(38),i(2),i(5),i(25);s.default.FMSynth=function(t){t=s.default.defaultArg(t,s.default.FMSynth.defaults),s.default.Monophonic.call(this,t),this._carrier=new s.default.Synth(t.carrier),this._carrier.volume.value=-10,this.oscillator=this._carrier.oscillator,this.envelope=this._carrier.envelope.set(t.envelope),this._modulator=new s.default.Synth(t.modulator),this._modulator.volume.value=-10,this.modulation=this._modulator.oscillator.set(t.modulation),this.modulationEnvelope=this._modulator.envelope.set(t.modulationEnvelope),this.frequency=new s.default.Signal(440,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this.modulationIndex=new s.default.Multiply(t.modulationIndex),this.modulationIndex.units=s.default.Type.Positive,this._modulationNode=new s.default.Gain(0),this.frequency.connect(this._carrier.frequency),this.frequency.chain(this.harmonicity,this._modulator.frequency),this.frequency.chain(this.modulationIndex,this._modulationNode),this.detune.fan(this._carrier.detune,this._modulator.detune),this._modulator.connect(this._modulationNode.gain),this._modulationNode.connect(this._carrier.frequency),this._carrier.connect(this.output),this._readOnly(["frequency","harmonicity","modulationIndex","oscillator","envelope","modulation","modulationEnvelope","detune"])},s.default.extend(s.default.FMSynth,s.default.Monophonic),s.default.FMSynth.defaults={harmonicity:3,modulationIndex:10,detune:0,oscillator:{type:"sine"},envelope:{attack:.01,decay:.01,sustain:1,release:.5},modulation:{type:"square"},modulationEnvelope:{attack:.5,decay:0,sustain:1,release:.5}},s.default.FMSynth.prototype._triggerEnvelopeAttack=function(t,e){return t=this.toSeconds(t),this._carrier._triggerEnvelopeAttack(t,e),this._modulator._triggerEnvelopeAttack(t),this},s.default.FMSynth.prototype._triggerEnvelopeRelease=function(t){return t=this.toSeconds(t),this._carrier._triggerEnvelopeRelease(t),this._modulator._triggerEnvelopeRelease(t),this},s.default.FMSynth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["frequency","harmonicity","modulationIndex","oscillator","envelope","modulation","modulationEnvelope","detune"]),this._carrier.dispose(),this._carrier=null,this._modulator.dispose(),this._modulator=null,this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null,this.modulationIndex.dispose(),this.modulationIndex=null,this.harmonicity.dispose(),this.harmonicity=null,this._modulationNode.dispose(),this._modulationNode=null,this.oscillator=null,this.envelope=null,this.modulationEnvelope=null,this.modulation=null,this},e.default=s.default.FMSynth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(66),i(12),i(2),i(5),i(25),i(14);s.default.DuoSynth=function(t){t=s.default.defaultArg(t,s.default.DuoSynth.defaults),s.default.Monophonic.call(this,t),this.voice0=new s.default.MonoSynth(t.voice0),this.voice0.volume.value=-10,this.voice1=new s.default.MonoSynth(t.voice1),this.voice1.volume.value=-10,this._vibrato=new s.default.LFO(t.vibratoRate,-50,50),this._vibrato.start(),this.vibratoRate=this._vibrato.frequency,this._vibratoGain=new s.default.Gain(t.vibratoAmount,s.default.Type.Positive),this.vibratoAmount=this._vibratoGain.gain,this.frequency=new s.default.Signal(440,s.default.Type.Frequency),this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this.frequency.connect(this.voice0.frequency),this.frequency.chain(this.harmonicity,this.voice1.frequency),this._vibrato.connect(this._vibratoGain),this._vibratoGain.fan(this.voice0.detune,this.voice1.detune),this.voice0.connect(this.output),this.voice1.connect(this.output),this._readOnly(["voice0","voice1","frequency","vibratoAmount","vibratoRate"])},s.default.extend(s.default.DuoSynth,s.default.Monophonic),s.default.DuoSynth.defaults={vibratoAmount:.5,vibratoRate:5,harmonicity:1.5,voice0:{volume:-10,portamento:0,oscillator:{type:"sine"},filterEnvelope:{attack:.01,decay:0,sustain:1,release:.5},envelope:{attack:.01,decay:0,sustain:1,release:.5}},voice1:{volume:-10,portamento:0,oscillator:{type:"sine"},filterEnvelope:{attack:.01,decay:0,sustain:1,release:.5},envelope:{attack:.01,decay:0,sustain:1,release:.5}}},s.default.DuoSynth.prototype._triggerEnvelopeAttack=function(t,e){return t=this.toSeconds(t),this.voice0._triggerEnvelopeAttack(t,e),this.voice1._triggerEnvelopeAttack(t,e),this},s.default.DuoSynth.prototype._triggerEnvelopeRelease=function(t){return this.voice0._triggerEnvelopeRelease(t),this.voice1._triggerEnvelopeRelease(t),this},s.default.DuoSynth.prototype.getLevelAtTime=function(t){return(this.voice0.getLevelAtTime(t)+this.voice1.getLevelAtTime(t))/2},s.default.DuoSynth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["voice0","voice1","frequency","vibratoAmount","vibratoRate"]),this.voice0.dispose(),this.voice0=null,this.voice1.dispose(),this.voice1=null,this.frequency.dispose(),this.frequency=null,this._vibratoGain.dispose(),this._vibratoGain=null,this._vibrato=null,this.harmonicity.dispose(),this.harmonicity=null,this.vibratoAmount.dispose(),this.vibratoAmount=null,this.vibratoRate=null,this},e.default=s.default.DuoSynth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(38),i(2),i(5),i(25),i(22),i(3);s.default.AMSynth=function(t){t=s.default.defaultArg(t,s.default.AMSynth.defaults),s.default.Monophonic.call(this,t),this._carrier=new s.default.Synth,this._carrier.volume.value=-10,this.oscillator=this._carrier.oscillator.set(t.oscillator),this.envelope=this._carrier.envelope.set(t.envelope),this._modulator=new s.default.Synth,this._modulator.volume.value=-10,this.modulation=this._modulator.oscillator.set(t.modulation),this.modulationEnvelope=this._modulator.envelope.set(t.modulationEnvelope),this.frequency=new s.default.Signal(440,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this._modulationScale=new s.default.AudioToGain,this._modulationNode=new s.default.Gain,this.frequency.connect(this._carrier.frequency),this.frequency.chain(this.harmonicity,this._modulator.frequency),this.detune.fan(this._carrier.detune,this._modulator.detune),this._modulator.chain(this._modulationScale,this._modulationNode.gain),this._carrier.chain(this._modulationNode,this.output),this._readOnly(["frequency","harmonicity","oscillator","envelope","modulation","modulationEnvelope","detune"])},s.default.extend(s.default.AMSynth,s.default.Monophonic),s.default.AMSynth.defaults={harmonicity:3,detune:0,oscillator:{type:"sine"},envelope:{attack:.01,decay:.01,sustain:1,release:.5},modulation:{type:"square"},modulationEnvelope:{attack:.5,decay:0,sustain:1,release:.5}},s.default.AMSynth.prototype._triggerEnvelopeAttack=function(t,e){return t=this.toSeconds(t),this._carrier._triggerEnvelopeAttack(t,e),this._modulator._triggerEnvelopeAttack(t),this},s.default.AMSynth.prototype._triggerEnvelopeRelease=function(t){return this._carrier._triggerEnvelopeRelease(t),this._modulator._triggerEnvelopeRelease(t),this},s.default.AMSynth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["frequency","harmonicity","oscillator","envelope","modulation","modulationEnvelope","detune"]),this._carrier.dispose(),this._carrier=null,this._modulator.dispose(),this._modulator=null,this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null,this.harmonicity.dispose(),this.harmonicity=null,this._modulationScale.dispose(),this._modulationScale=null,this._modulationNode.dispose(),this._modulationNode=null,this.oscillator=null,this.envelope=null,this.modulationEnvelope=null,this.modulation=null,this},e.default=s.default.AMSynth},function(t,e,i){"use strict";i.r(e);var s=i(0);i(70),i(16);s.default.Sequence=function(){var t=s.default.defaults(arguments,["callback","events","subdivision"],s.default.Sequence),e=t.events;if(delete t.events,s.default.Part.call(this,t),this._subdivision=this.toTicks(t.subdivision),s.default.isUndef(t.loopEnd)&&s.default.isDefined(e)&&(this._loopEnd=e.length*this._subdivision),this._loop=!0,s.default.isDefined(e))for(var i=0;i<e.length;i++)this.add(i,e[i])},s.default.extend(s.default.Sequence,s.default.Part),s.default.Sequence.defaults={subdivision:"4n"},Object.defineProperty(s.default.Sequence.prototype,"subdivision",{get:function(){return s.default.Ticks(this._subdivision).toSeconds()}}),s.default.Sequence.prototype.at=function(t,e){return s.default.isArray(e)&&this.remove(t),s.default.Part.prototype.at.call(this,this._indexTime(t),e)},s.default.Sequence.prototype.add=function(t,e){if(null===e)return this;if(s.default.isArray(e)){var i=Math.round(this._subdivision/e.length);e=new s.default.Sequence(this._tick.bind(this),e,s.default.Ticks(i))}return s.default.Part.prototype.add.call(this,this._indexTime(t),e),this},s.default.Sequence.prototype.remove=function(t,e){return s.default.Part.prototype.remove.call(this,this._indexTime(t),e),this},s.default.Sequence.prototype._indexTime=function(t){return t instanceof s.default.TransportTime?t:s.default.Ticks(t*this._subdivision+this.startOffset).toSeconds()},s.default.Sequence.prototype.dispose=function(){return s.default.Part.prototype.dispose.call(this),this},e.default=s.default.Sequence},function(t,e,i){"use strict";i.r(e);var s=i(0);i(71),i(79);s.default.Pattern=function(){var t=s.default.defaults(arguments,["callback","values","pattern"],s.default.Pattern);s.default.Loop.call(this,t),this._pattern=new s.default.CtrlPattern({values:t.values,type:t.pattern,index:t.index})},s.default.extend(s.default.Pattern,s.default.Loop),s.default.Pattern.defaults={pattern:s.default.CtrlPattern.Type.Up,callback:s.default.noOp,values:[]},s.default.Pattern.prototype._tick=function(t){this.callback(t,this._pattern.value),this._pattern.next()},Object.defineProperty(s.default.Pattern.prototype,"index",{get:function(){return this._pattern.index},set:function(t){this._pattern.index=t}}),Object.defineProperty(s.default.Pattern.prototype,"values",{get:function(){return this._pattern.values},set:function(t){this._pattern.values=t}}),Object.defineProperty(s.default.Pattern.prototype,"value",{get:function(){return this._pattern.value}}),Object.defineProperty(s.default.Pattern.prototype,"pattern",{get:function(){return this._pattern.type},set:function(t){this._pattern.type=t}}),s.default.Pattern.prototype.dispose=function(){s.default.Loop.prototype.dispose.call(this),this._pattern.dispose(),this._pattern=null},e.default=s.default.Pattern},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(18),i(12);s.default.Vibrato=function(){var t=s.default.defaults(arguments,["frequency","depth"],s.default.Vibrato);s.default.Effect.call(this,t),this._delayNode=new s.default.Delay(0,t.maxDelay),this._lfo=new s.default.LFO({type:t.type,min:0,max:t.maxDelay,frequency:t.frequency,phase:-90}).start().connect(this._delayNode.delayTime),this.frequency=this._lfo.frequency,this.depth=this._lfo.amplitude,this.depth.value=t.depth,this._readOnly(["frequency","depth"]),this.effectSend.chain(this._delayNode,this.effectReturn)},s.default.extend(s.default.Vibrato,s.default.Effect),s.default.Vibrato.defaults={maxDelay:.005,frequency:5,depth:.1,type:"sine"},Object.defineProperty(s.default.Vibrato.prototype,"type",{get:function(){return this._lfo.type},set:function(t){this._lfo.type=t}}),s.default.Vibrato.prototype.dispose=function(){s.default.Effect.prototype.dispose.call(this),this._delayNode.dispose(),this._delayNode=null,this._lfo.dispose(),this._lfo=null,this._writable(["frequency","depth"]),this.frequency=null,this.depth=null},e.default=s.default.Vibrato},function(t,e,i){"use strict";i.r(e);var s=i(0);i(12),i(15);s.default.Tremolo=function(){var t=s.default.defaults(arguments,["frequency","depth"],s.default.Tremolo);s.default.StereoEffect.call(this,t),this._lfoL=new s.default.LFO({phase:t.spread,min:1,max:0}),this._lfoR=new s.default.LFO({phase:t.spread,min:1,max:0}),this._amplitudeL=new s.default.Gain,this._amplitudeR=new s.default.Gain,this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.depth=new s.default.Signal(t.depth,s.default.Type.NormalRange),this._readOnly(["frequency","depth"]),this.effectSendL.chain(this._amplitudeL,this.effectReturnL),this.effectSendR.chain(this._amplitudeR,this.effectReturnR),this._lfoL.connect(this._amplitudeL.gain),this._lfoR.connect(this._amplitudeR.gain),this.frequency.fan(this._lfoL.frequency,this._lfoR.frequency),this.depth.fan(this._lfoR.amplitude,this._lfoL.amplitude),this.type=t.type,this.spread=t.spread},s.default.extend(s.default.Tremolo,s.default.StereoEffect),s.default.Tremolo.defaults={frequency:10,type:"sine",depth:.5,spread:180},s.default.Tremolo.prototype.start=function(t){return this._lfoL.start(t),this._lfoR.start(t),this},s.default.Tremolo.prototype.stop=function(t){return this._lfoL.stop(t),this._lfoR.stop(t),this},s.default.Tremolo.prototype.sync=function(t){return this._lfoL.sync(t),this._lfoR.sync(t),s.default.Transport.syncSignal(this.frequency),this},s.default.Tremolo.prototype.unsync=function(){return this._lfoL.unsync(),this._lfoR.unsync(),s.default.Transport.unsyncSignal(this.frequency),this},Object.defineProperty(s.default.Tremolo.prototype,"type",{get:function(){return this._lfoL.type},set:function(t){this._lfoL.type=t,this._lfoR.type=t}}),Object.defineProperty(s.default.Tremolo.prototype,"spread",{get:function(){return this._lfoR.phase-this._lfoL.phase},set:function(t){this._lfoL.phase=90-t/2,this._lfoR.phase=t/2+90}}),s.default.Tremolo.prototype.dispose=function(){return s.default.StereoEffect.prototype.dispose.call(this),this._writable(["frequency","depth"]),this._lfoL.dispose(),this._lfoL=null,this._lfoR.dispose(),this._lfoR=null,this._amplitudeL.dispose(),this._amplitudeL=null,this._amplitudeR.dispose(),this._amplitudeR=null,this.frequency=null,this.depth=null,this},e.default=s.default.Tremolo},function(t,e,i){"use strict";i.r(e);var s=i(0);i(73),i(2),i(5),i(13);s.default.StereoWidener=function(){var t=s.default.defaults(arguments,["width"],s.default.StereoWidener);s.default.MidSideEffect.call(this,t),this.width=new s.default.Signal(t.width,s.default.Type.NormalRange),this._readOnly(["width"]),this._twoTimesWidthMid=new s.default.Multiply(2),this._twoTimesWidthSide=new s.default.Multiply(2),this._midMult=new s.default.Multiply,this._twoTimesWidthMid.connect(this._midMult,0,1),this.midSend.chain(this._midMult,this.midReturn),this._oneMinusWidth=new s.default.Subtract,this._oneMinusWidth.connect(this._twoTimesWidthMid),s.default.connect(this.context.getConstant(1),this._oneMinusWidth,0,0),this.width.connect(this._oneMinusWidth,0,1),this._sideMult=new s.default.Multiply,this.width.connect(this._twoTimesWidthSide),this._twoTimesWidthSide.connect(this._sideMult,0,1),this.sideSend.chain(this._sideMult,this.sideReturn)},s.default.extend(s.default.StereoWidener,s.default.MidSideEffect),s.default.StereoWidener.defaults={width:.5},s.default.StereoWidener.prototype.dispose=function(){return s.default.MidSideEffect.prototype.dispose.call(this),this._writable(["width"]),this.width.dispose(),this.width=null,this._midMult.dispose(),this._midMult=null,this._sideMult.dispose(),this._sideMult=null,this._twoTimesWidthMid.dispose(),this._twoTimesWidthMid=null,this._twoTimesWidthSide.dispose(),this._twoTimesWidthSide=null,this._oneMinusWidth.dispose(),this._oneMinusWidth=null,this},e.default=s.default.StereoWidener},function(t,e,i){"use strict";i.r(e);var s=i(0);i(15),i(33),i(3);s.default.StereoFeedbackEffect=function(){var t=s.default.defaults(arguments,["feedback"],s.default.FeedbackEffect);s.default.StereoEffect.call(this,t),this.feedback=new s.default.Signal(t.feedback,s.default.Type.NormalRange),this._feedbackL=new s.default.Gain,this._feedbackR=new s.default.Gain,this.effectReturnL.chain(this._feedbackL,this.effectSendL),this.effectReturnR.chain(this._feedbackR,this.effectSendR),this.feedback.fan(this._feedbackL.gain,this._feedbackR.gain),this._readOnly(["feedback"])},s.default.extend(s.default.StereoFeedbackEffect,s.default.StereoEffect),s.default.StereoFeedbackEffect.prototype.dispose=function(){return s.default.StereoEffect.prototype.dispose.call(this),this._writable(["feedback"]),this.feedback.dispose(),this.feedback=null,this._feedbackL.dispose(),this._feedbackL=null,this._feedbackR.dispose(),this._feedbackR=null,this},e.default=s.default.StereoFeedbackEffect},function(t,e,i){"use strict";i.r(e);var s=i(0);i(77),i(9),i(10),i(39),i(3),i(74);s.default.Reverb=function(){var t=s.default.defaults(arguments,["decay"],s.default.Reverb);s.default.Effect.call(this,t),this._convolver=this.context.createConvolver(),this.decay=t.decay,this.preDelay=t.preDelay,this.connectEffect(this._convolver)},s.default.extend(s.default.Reverb,s.default.Effect),s.default.Reverb.defaults={decay:1.5,preDelay:.01},s.default.Reverb.prototype.generate=function(){return s.default.Offline(function(){var t=new s.default.Noise,e=new s.default.Noise,i=new s.default.Merge;t.connect(i.left),e.connect(i.right);var n=(new s.default.Gain).toMaster();i.connect(n),t.start(0),e.start(0),n.gain.setValueAtTime(0,0),n.gain.setValueAtTime(1,this.preDelay),n.gain.exponentialApproachValueAtTime(0,this.preDelay,this.decay+this.preDelay)}.bind(this),this.decay+this.preDelay).then(function(t){return this._convolver.buffer=t.get(),this}.bind(this))},s.default.Reverb.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._convolver.disconnect(),this._convolver=null,this},e.default=s.default.Reverb},function(t,e,i){"use strict";i.r(e);var s=i(0);i(12),i(23),i(2),i(33),i(18);s.default.PitchShift=function(){var t=s.default.defaults(arguments,["pitch"],s.default.PitchShift);s.default.FeedbackEffect.call(this,t),this._frequency=new s.default.Signal(0),this._delayA=new s.default.Delay(0,1),this._lfoA=new s.default.LFO({min:0,max:.1,type:"sawtooth"}).connect(this._delayA.delayTime),this._delayB=new s.default.Delay(0,1),this._lfoB=new s.default.LFO({min:0,max:.1,type:"sawtooth",phase:180}).connect(this._delayB.delayTime),this._crossFade=new s.default.CrossFade,this._crossFadeLFO=new s.default.LFO({min:0,max:1,type:"triangle",phase:90}).connect(this._crossFade.fade),this._feedbackDelay=new s.default.Delay(t.delayTime),this.delayTime=this._feedbackDelay.delayTime,this._readOnly("delayTime"),this._pitch=t.pitch,this._windowSize=t.windowSize,this._delayA.connect(this._crossFade.a),this._delayB.connect(this._crossFade.b),this._frequency.fan(this._lfoA.frequency,this._lfoB.frequency,this._crossFadeLFO.frequency),this.effectSend.fan(this._delayA,this._delayB),this._crossFade.chain(this._feedbackDelay,this.effectReturn);var e=this.now();this._lfoA.start(e),this._lfoB.start(e),this._crossFadeLFO.start(e),this.windowSize=this._windowSize},s.default.extend(s.default.PitchShift,s.default.FeedbackEffect),s.default.PitchShift.defaults={pitch:0,windowSize:.1,delayTime:0,feedback:0},Object.defineProperty(s.default.PitchShift.prototype,"pitch",{get:function(){return this._pitch},set:function(t){this._pitch=t;var e=0;t<0?(this._lfoA.min=0,this._lfoA.max=this._windowSize,this._lfoB.min=0,this._lfoB.max=this._windowSize,e=s.default.intervalToFrequencyRatio(t-1)+1):(this._lfoA.min=this._windowSize,this._lfoA.max=0,this._lfoB.min=this._windowSize,this._lfoB.max=0,e=s.default.intervalToFrequencyRatio(t)-1),this._frequency.value=e*(1.2/this._windowSize)}}),Object.defineProperty(s.default.PitchShift.prototype,"windowSize",{get:function(){return this._windowSize},set:function(t){this._windowSize=this.toSeconds(t),this.pitch=this._pitch}}),s.default.PitchShift.prototype.dispose=function(){return s.default.FeedbackEffect.prototype.dispose.call(this),this._frequency.dispose(),this._frequency=null,this._delayA.disconnect(),this._delayA=null,this._delayB.disconnect(),this._delayB=null,this._lfoA.dispose(),this._lfoA=null,this._lfoB.dispose(),this._lfoB=null,this._crossFade.dispose(),this._crossFade=null,this._crossFadeLFO.dispose(),this._crossFadeLFO=null,this._writable("delayTime"),this._feedbackDelay.dispose(),this._feedbackDelay=null,this.delayTime=null,this},e.default=s.default.PitchShift},function(t,e,i){"use strict";i.r(e);var s=i(0);i(72),i(2),i(18);s.default.PingPongDelay=function(){var t=s.default.defaults(arguments,["delayTime","feedback"],s.default.PingPongDelay);s.default.StereoXFeedbackEffect.call(this,t),this._leftDelay=new s.default.Delay(0,t.maxDelayTime),this._rightDelay=new s.default.Delay(0,t.maxDelayTime),this._rightPreDelay=new s.default.Delay(0,t.maxDelayTime),this.delayTime=new s.default.Signal(t.delayTime,s.default.Type.Time),this.effectSendL.chain(this._leftDelay,this.effectReturnL),this.effectSendR.chain(this._rightPreDelay,this._rightDelay,this.effectReturnR),this.delayTime.fan(this._leftDelay.delayTime,this._rightDelay.delayTime,this._rightPreDelay.delayTime),this._feedbackLR.disconnect(),this._feedbackLR.connect(this._rightDelay),this._readOnly(["delayTime"])},s.default.extend(s.default.PingPongDelay,s.default.StereoXFeedbackEffect),s.default.PingPongDelay.defaults={delayTime:.25,maxDelayTime:1},s.default.PingPongDelay.prototype.dispose=function(){return s.default.StereoXFeedbackEffect.prototype.dispose.call(this),this._leftDelay.dispose(),this._leftDelay=null,this._rightDelay.dispose(),this._rightDelay=null,this._rightPreDelay.dispose(),this._rightPreDelay=null,this._writable(["delayTime"]),this.delayTime.dispose(),this.delayTime=null,this},e.default=s.default.PingPongDelay},function(t,e,i){"use strict";i.r(e);var s=i(0);i(12),i(9),i(15);s.default.Phaser=function(){var t=s.default.defaults(arguments,["frequency","octaves","baseFrequency"],s.default.Phaser);s.default.StereoEffect.call(this,t),this._lfoL=new s.default.LFO(t.frequency,0,1),this._lfoR=new s.default.LFO(t.frequency,0,1),this._lfoR.phase=180,this._baseFrequency=t.baseFrequency,this._octaves=t.octaves,this.Q=new s.default.Signal(t.Q,s.default.Type.Positive),this._filtersL=this._makeFilters(t.stages,this._lfoL,this.Q),this._filtersR=this._makeFilters(t.stages,this._lfoR,this.Q),this.frequency=this._lfoL.frequency,this.frequency.value=t.frequency,this.effectSendL.connect(this._filtersL[0]),this.effectSendR.connect(this._filtersR[0]),s.default.connect(this._filtersL[t.stages-1],this.effectReturnL),s.default.connect(this._filtersR[t.stages-1],this.effectReturnR),this._lfoL.frequency.connect(this._lfoR.frequency),this.baseFrequency=t.baseFrequency,this.octaves=t.octaves,this._lfoL.start(),this._lfoR.start(),this._readOnly(["frequency","Q"])},s.default.extend(s.default.Phaser,s.default.StereoEffect),s.default.Phaser.defaults={frequency:.5,octaves:3,stages:10,Q:10,baseFrequency:350},s.default.Phaser.prototype._makeFilters=function(t,e,i){for(var n=new Array(t),o=0;o<t;o++){var a=this.context.createBiquadFilter();a.type="allpass",i.connect(a.Q),e.connect(a.frequency),n[o]=a}return s.default.connectSeries.apply(s.default,n),n},Object.defineProperty(s.default.Phaser.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t;var e=this._baseFrequency*Math.pow(2,t);this._lfoL.max=e,this._lfoR.max=e}}),Object.defineProperty(s.default.Phaser.prototype,"baseFrequency",{get:function(){return this._baseFrequency},set:function(t){this._baseFrequency=t,this._lfoL.min=t,this._lfoR.min=t,this.octaves=this._octaves}}),s.default.Phaser.prototype.dispose=function(){s.default.StereoEffect.prototype.dispose.call(this),this._writable(["frequency","Q"]),this.Q.dispose(),this.Q=null,this._lfoL.dispose(),this._lfoL=null,this._lfoR.dispose(),this._lfoR=null;for(var t=0;t<this._filtersL.length;t++)this._filtersL[t].disconnect(),this._filtersL[t]=null;this._filtersL=null;for(var e=0;e<this._filtersR.length;e++)this._filtersR[e].disconnect(),this._filtersR[e]=null;return this._filtersR=null,this.frequency=null,this},e.default=s.default.Phaser},function(t,e,i){"use strict";i.r(e);var s=i(0),n=(i(59),i(15),i(26),[.06748,.06404,.08212,.09004]),o=[.773,.802,.753,.733],a=[347,113,37];s.default.JCReverb=function(){var t=s.default.defaults(arguments,["roomSize"],s.default.JCReverb);s.default.StereoEffect.call(this,t),this.roomSize=new s.default.Signal(t.roomSize,s.default.Type.NormalRange),this._scaleRoomSize=new s.default.Scale(-.733,.197),this._allpassFilters=[],this._feedbackCombFilters=[];for(var e=0;e<a.length;e++){var i=this.context.createBiquadFilter();i.type="allpass",i.frequency.value=a[e],this._allpassFilters.push(i)}for(var r=0;r<n.length;r++){var l=new s.default.FeedbackCombFilter(n[r],.1);this._scaleRoomSize.connect(l.resonance),l.resonance.value=o[r],s.default.connect(this._allpassFilters[this._allpassFilters.length-1],l),r<n.length/2?l.connect(this.effectReturnL):l.connect(this.effectReturnR),this._feedbackCombFilters.push(l)}this.roomSize.connect(this._scaleRoomSize),s.default.connectSeries.apply(s.default,this._allpassFilters),this.effectSendL.connect(this._allpassFilters[0]),this.effectSendR.connect(this._allpassFilters[0]),this._readOnly(["roomSize"])},s.default.extend(s.default.JCReverb,s.default.StereoEffect),s.default.JCReverb.defaults={roomSize:.5},s.default.JCReverb.prototype.dispose=function(){s.default.StereoEffect.prototype.dispose.call(this);for(var t=0;t<this._allpassFilters.length;t++)this._allpassFilters[t].disconnect(),this._allpassFilters[t]=null;this._allpassFilters=null;for(var e=0;e<this._feedbackCombFilters.length;e++)this._feedbackCombFilters[e].dispose(),this._feedbackCombFilters[e]=null;return this._feedbackCombFilters=null,this._writable(["roomSize"]),this.roomSize.dispose(),this.roomSize=null,this._scaleRoomSize.dispose(),this._scaleRoomSize=null,this},e.default=s.default.JCReverb},function(t,e,i){"use strict";i.r(e);var s=i(0),n=(i(54),i(15),i(2),i(19),i(10),i(42),[1557/44100,1617/44100,1491/44100,1422/44100,1277/44100,1356/44100,1188/44100,1116/44100]),o=[225,556,441,341];s.default.Freeverb=function(){var t=s.default.defaults(arguments,["roomSize","dampening"],s.default.Freeverb);s.default.StereoEffect.call(this,t),this.roomSize=new s.default.Signal(t.roomSize,s.default.Type.NormalRange),this.dampening=new s.default.Signal(t.dampening,s.default.Type.Frequency),this._combFilters=[],this._allpassFiltersL=[],this._allpassFiltersR=[];for(var e=0;e<o.length;e++){var i=this.context.createBiquadFilter();i.type="allpass",i.frequency.value=o[e],this._allpassFiltersL.push(i)}for(var a=0;a<o.length;a++){var r=this.context.createBiquadFilter();r.type="allpass",r.frequency.value=o[a],this._allpassFiltersR.push(r)}for(var l=0;l<n.length;l++){var u=new s.default.LowpassCombFilter(n[l]);l<n.length/2?this.effectSendL.chain(u,this._allpassFiltersL[0]):this.effectSendR.chain(u,this._allpassFiltersR[0]),this.roomSize.connect(u.resonance),this.dampening.connect(u.dampening),this._combFilters.push(u)}s.default.connectSeries.apply(s.default,this._allpassFiltersL),s.default.connectSeries.apply(s.default,this._allpassFiltersR),s.default.connect(this._allpassFiltersL[this._allpassFiltersL.length-1],this.effectReturnL),s.default.connect(this._allpassFiltersR[this._allpassFiltersR.length-1],this.effectReturnR),this._readOnly(["roomSize","dampening"])},s.default.extend(s.default.Freeverb,s.default.StereoEffect),s.default.Freeverb.defaults={roomSize:.7,dampening:3e3},s.default.Freeverb.prototype.dispose=function(){s.default.StereoEffect.prototype.dispose.call(this);for(var t=0;t<this._allpassFiltersL.length;t++)this._allpassFiltersL[t].disconnect(),this._allpassFiltersL[t]=null;this._allpassFiltersL=null;for(var e=0;e<this._allpassFiltersR.length;e++)this._allpassFiltersR[e].disconnect(),this._allpassFiltersR[e]=null;this._allpassFiltersR=null;for(var i=0;i<this._combFilters.length;i++)this._combFilters[i].dispose(),this._combFilters[i]=null;return this._combFilters=null,this._writable(["roomSize","dampening"]),this.roomSize.dispose(),this.roomSize=null,this.dampening.dispose(),this.dampening=null,this},e.default=s.default.Freeverb},function(t,e,i){"use strict";i.r(e);var s=i(0);i(33),i(2),i(18);s.default.FeedbackDelay=function(){var t=s.default.defaults(arguments,["delayTime","feedback"],s.default.FeedbackDelay);s.default.FeedbackEffect.call(this,t),this._delayNode=new s.default.Delay(t.delayTime,t.maxDelay),this.delayTime=this._delayNode.delayTime,this.connectEffect(this._delayNode),this._readOnly(["delayTime"])},s.default.extend(s.default.FeedbackDelay,s.default.FeedbackEffect),s.default.FeedbackDelay.defaults={delayTime:.25,maxDelay:1},s.default.FeedbackDelay.prototype.dispose=function(){return s.default.FeedbackEffect.prototype.dispose.call(this),this._delayNode.dispose(),this._delayNode=null,this._writable(["delayTime"]),this.delayTime=null,this},e.default=s.default.FeedbackDelay},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(7);s.default.Distortion=function(){var t=s.default.defaults(arguments,["distortion"],s.default.Distortion);s.default.Effect.call(this,t),this._shaper=new s.default.WaveShaper(4096),this._distortion=t.distortion,this.connectEffect(this._shaper),this.distortion=t.distortion,this.oversample=t.oversample},s.default.extend(s.default.Distortion,s.default.Effect),s.default.Distortion.defaults={distortion:.4,oversample:"none"},Object.defineProperty(s.default.Distortion.prototype,"distortion",{get:function(){return this._distortion},set:function(t){this._distortion=t;var e=100*t,i=Math.PI/180;this._shaper.setMap(function(t){return Math.abs(t)<.001?0:(3+e)*t*20*i/(Math.PI+e*Math.abs(t))})}}),Object.defineProperty(s.default.Distortion.prototype,"oversample",{get:function(){return this._shaper.oversample},set:function(t){this._shaper.oversample=t}}),s.default.Distortion.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._shaper.dispose(),this._shaper=null,this},e.default=s.default.Distortion},function(t,e,i){"use strict";i.r(e);var s=i(0);i(12),i(15),i(18);s.default.Chorus=function(){var t=s.default.defaults(arguments,["frequency","delayTime","depth"],s.default.Chorus);s.default.StereoEffect.call(this,t),this._depth=t.depth,this._delayTime=t.delayTime/1e3,this._lfoL=new s.default.LFO({frequency:t.frequency,min:0,max:1}),this._lfoR=new s.default.LFO({frequency:t.frequency,min:0,max:1,phase:180}),this._delayNodeL=new s.default.Delay,this._delayNodeR=new s.default.Delay,this.frequency=this._lfoL.frequency,this.effectSendL.chain(this._delayNodeL,this.effectReturnL),this.effectSendR.chain(this._delayNodeR,this.effectReturnR),this.effectSendL.connect(this.effectReturnL),this.effectSendR.connect(this.effectReturnR),this._lfoL.connect(this._delayNodeL.delayTime),this._lfoR.connect(this._delayNodeR.delayTime),this._lfoL.start(),this._lfoR.start(),this._lfoL.frequency.connect(this._lfoR.frequency),this.depth=this._depth,this.frequency.value=t.frequency,this.type=t.type,this._readOnly(["frequency"]),this.spread=t.spread},s.default.extend(s.default.Chorus,s.default.StereoEffect),s.default.Chorus.defaults={frequency:1.5,delayTime:3.5,depth:.7,type:"sine",spread:180},Object.defineProperty(s.default.Chorus.prototype,"depth",{get:function(){return this._depth},set:function(t){this._depth=t;var e=this._delayTime*t;this._lfoL.min=Math.max(this._delayTime-e,0),this._lfoL.max=this._delayTime+e,this._lfoR.min=Math.max(this._delayTime-e,0),this._lfoR.max=this._delayTime+e}}),Object.defineProperty(s.default.Chorus.prototype,"delayTime",{get:function(){return 1e3*this._delayTime},set:function(t){this._delayTime=t/1e3,this.depth=this._depth}}),Object.defineProperty(s.default.Chorus.prototype,"type",{get:function(){return this._lfoL.type},set:function(t){this._lfoL.type=t,this._lfoR.type=t}}),Object.defineProperty(s.default.Chorus.prototype,"spread",{get:function(){return this._lfoR.phase-this._lfoL.phase},set:function(t){this._lfoL.phase=90-t/2,this._lfoR.phase=t/2+90}}),s.default.Chorus.prototype.dispose=function(){return s.default.StereoEffect.prototype.dispose.call(this),this._lfoL.dispose(),this._lfoL=null,this._lfoR.dispose(),this._lfoR=null,this._delayNodeL.dispose(),this._delayNodeL=null,this._delayNodeR.dispose(),this._delayNodeR=null,this._writable("frequency"),this.frequency=null,this},e.default=s.default.Chorus},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(7);s.default.Chebyshev=function(){var t=s.default.defaults(arguments,["order"],s.default.Chebyshev);s.default.Effect.call(this,t),this._shaper=new s.default.WaveShaper(4096),this._order=t.order,this.connectEffect(this._shaper),this.order=t.order,this.oversample=t.oversample},s.default.extend(s.default.Chebyshev,s.default.Effect),s.default.Chebyshev.defaults={order:1,oversample:"none"},s.default.Chebyshev.prototype._getCoefficient=function(t,e,i){return i.hasOwnProperty(e)?i[e]:(i[e]=0===e?0:1===e?t:2*t*this._getCoefficient(t,e-1,i)-this._getCoefficient(t,e-2,i),i[e])},Object.defineProperty(s.default.Chebyshev.prototype,"order",{get:function(){return this._order},set:function(t){this._order=t;for(var e=new Array(4096),i=e.length,s=0;s<i;++s){var n=2*s/i-1;e[s]=0===n?0:this._getCoefficient(n,t,{})}this._shaper.curve=e}}),Object.defineProperty(s.default.Chebyshev.prototype,"oversample",{get:function(){return this._shaper.oversample},set:function(t){this._shaper.oversample=t}}),s.default.Chebyshev.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._shaper.dispose(),this._shaper=null,this},e.default=s.default.Chebyshev},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(13),i(75);s.default.BitCrusher=function(){var t=s.default.defaults(arguments,["bits"],s.default.BitCrusher);s.default.Effect.call(this,t);var e=1/Math.pow(2,t.bits-1);this._subtract=new s.default.Subtract,this._modulo=new s.default.Modulo(e),this._bits=t.bits,this.effectSend.fan(this._subtract,this._modulo),this._modulo.connect(this._subtract,0,1),this._subtract.connect(this.effectReturn)},s.default.extend(s.default.BitCrusher,s.default.Effect),s.default.BitCrusher.defaults={bits:4},Object.defineProperty(s.default.BitCrusher.prototype,"bits",{get:function(){return this._bits},set:function(t){this._bits=t;var e=1/Math.pow(2,t-1);this._modulo.value=e}}),s.default.BitCrusher.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._subtract.dispose(),this._subtract=null,this._modulo.dispose(),this._modulo=null,this},e.default=s.default.BitCrusher},function(t,e,i){"use strict";i.r(e);var s=i(0);i(58),i(42),i(8),i(9);s.default.AutoWah=function(){var t=s.default.defaults(arguments,["baseFrequency","octaves","sensitivity"],s.default.AutoWah);s.default.Effect.call(this,t),this.follower=new s.default.Follower(t.follower),this._sweepRange=new s.default.ScaleExp(0,1,.5),this._baseFrequency=t.baseFrequency,this._octaves=t.octaves,this._inputBoost=new s.default.Gain,this._bandpass=new s.default.Filter({rolloff:-48,frequency:0,Q:t.Q}),this._peaking=new s.default.Filter(0,"peaking"),this._peaking.gain.value=t.gain,this.gain=this._peaking.gain,this.Q=this._bandpass.Q,this.effectSend.chain(this._inputBoost,this.follower,this._sweepRange),this._sweepRange.connect(this._bandpass.frequency),this._sweepRange.connect(this._peaking.frequency),this.effectSend.chain(this._bandpass,this._peaking,this.effectReturn),this._setSweepRange(),this.sensitivity=t.sensitivity,this._readOnly(["gain","Q"])},s.default.extend(s.default.AutoWah,s.default.Effect),s.default.AutoWah.defaults={baseFrequency:100,octaves:6,sensitivity:0,Q:2,gain:2,follower:{attack:.3,release:.5}},Object.defineProperty(s.default.AutoWah.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t,this._setSweepRange()}}),Object.defineProperty(s.default.AutoWah.prototype,"baseFrequency",{get:function(){return this._baseFrequency},set:function(t){this._baseFrequency=t,this._setSweepRange()}}),Object.defineProperty(s.default.AutoWah.prototype,"sensitivity",{get:function(){return s.default.gainToDb(1/this._inputBoost.gain.value)},set:function(t){this._inputBoost.gain.value=1/s.default.dbToGain(t)}}),s.default.AutoWah.prototype._setSweepRange=function(){this._sweepRange.min=this._baseFrequency,this._sweepRange.max=Math.min(this._baseFrequency*Math.pow(2,this._octaves),this.context.sampleRate/2)},s.default.AutoWah.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this.follower.dispose(),this.follower=null,this._sweepRange.dispose(),this._sweepRange=null,this._bandpass.dispose(),this._bandpass=null,this._peaking.dispose(),this._peaking=null,this._inputBoost.dispose(),this._inputBoost=null,this._writable(["gain","Q"]),this.gain=null,this.Q=null,this},e.default=s.default.AutoWah},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(12),i(48);s.default.AutoPanner=function(){var t=s.default.defaults(arguments,["frequency"],s.default.AutoPanner);s.default.Effect.call(this,t),this._lfo=new s.default.LFO({frequency:t.frequency,amplitude:t.depth,min:-1,max:1}),this.depth=this._lfo.amplitude,this._panner=new s.default.Panner,this.frequency=this._lfo.frequency,this.connectEffect(this._panner),this._lfo.connect(this._panner.pan),this.type=t.type,this._readOnly(["depth","frequency"])},s.default.extend(s.default.AutoPanner,s.default.Effect),s.default.AutoPanner.defaults={frequency:1,type:"sine",depth:1},s.default.AutoPanner.prototype.start=function(t){return this._lfo.start(t),this},s.default.AutoPanner.prototype.stop=function(t){return this._lfo.stop(t),this},s.default.AutoPanner.prototype.sync=function(t){return this._lfo.sync(t),this},s.default.AutoPanner.prototype.unsync=function(){return this._lfo.unsync(),this},Object.defineProperty(s.default.AutoPanner.prototype,"type",{get:function(){return this._lfo.type},set:function(t){this._lfo.type=t}}),s.default.AutoPanner.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._lfo.dispose(),this._lfo=null,this._panner.dispose(),this._panner=null,this._writable(["depth","frequency"]),this.frequency=null,this.depth=null,this},e.default=s.default.AutoPanner},function(t,e,i){"use strict";i.r(e);var s=i(0);i(8),i(12),i(9);s.default.AutoFilter=function(){var t=s.default.defaults(arguments,["frequency","baseFrequency","octaves"],s.default.AutoFilter);s.default.Effect.call(this,t),this._lfo=new s.default.LFO({frequency:t.frequency,amplitude:t.depth}),this.depth=this._lfo.amplitude,this.frequency=this._lfo.frequency,this.filter=new s.default.Filter(t.filter),this._octaves=0,this.connectEffect(this.filter),this._lfo.connect(this.filter.frequency),this.type=t.type,this._readOnly(["frequency","depth"]),this.octaves=t.octaves,this.baseFrequency=t.baseFrequency},s.default.extend(s.default.AutoFilter,s.default.Effect),s.default.AutoFilter.defaults={frequency:1,type:"sine",depth:1,baseFrequency:200,octaves:2.6,filter:{type:"lowpass",rolloff:-12,Q:1}},s.default.AutoFilter.prototype.start=function(t){return this._lfo.start(t),this},s.default.AutoFilter.prototype.stop=function(t){return this._lfo.stop(t),this},s.default.AutoFilter.prototype.sync=function(t){return this._lfo.sync(t),this},s.default.AutoFilter.prototype.unsync=function(){return this._lfo.unsync(),this},Object.defineProperty(s.default.AutoFilter.prototype,"type",{get:function(){return this._lfo.type},set:function(t){this._lfo.type=t}}),Object.defineProperty(s.default.AutoFilter.prototype,"baseFrequency",{get:function(){return this._lfo.min},set:function(t){this._lfo.min=this.toFrequency(t),this.octaves=this._octaves}}),Object.defineProperty(s.default.AutoFilter.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t,this._lfo.max=this.baseFrequency*Math.pow(2,t)}}),s.default.AutoFilter.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._lfo.dispose(),this._lfo=null,this.filter.dispose(),this.filter=null,this._writable(["frequency","depth"]),this.frequency=null,this.depth=null,this},e.default=s.default.AutoFilter},function(t,e,i){"use strict";i.r(e);var s=i(0);i(23),i(10),i(19),i(2),i(22),i(28);s.default.Listener=function(){s.default.call(this),this._orientation=[0,0,0,0,0,0],this._position=[0,0,0],s.default.getContext(function(){this.set(n.defaults)}.bind(this))},s.default.extend(s.default.Listener),s.default.Listener.defaults={positionX:0,positionY:0,positionZ:0,forwardX:0,forwardY:0,forwardZ:1,upX:0,upY:1,upZ:0},s.default.Listener.prototype.isListener=!0,s.default.Listener.prototype._rampTimeConstant=.01,s.default.Listener.prototype.setPosition=function(t,e,i){if(this.context.rawContext.listener.positionX){var s=this.now();this.context.rawContext.listener.positionX.setTargetAtTime(t,s,this._rampTimeConstant),this.context.rawContext.listener.positionY.setTargetAtTime(e,s,this._rampTimeConstant),this.context.rawContext.listener.positionZ.setTargetAtTime(i,s,this._rampTimeConstant)}else this.context.rawContext.listener.setPosition(t,e,i);return this._position=Array.prototype.slice.call(arguments),this},s.default.Listener.prototype.setOrientation=function(t,e,i,s,n,o){if(this.context.rawContext.listener.forwardX){var a=this.now();this.context.rawContext.listener.forwardX.setTargetAtTime(t,a,this._rampTimeConstant),this.context.rawContext.listener.forwardY.setTargetAtTime(e,a,this._rampTimeConstant),this.context.rawContext.listener.forwardZ.setTargetAtTime(i,a,this._rampTimeConstant),this.context.rawContext.listener.upX.setTargetAtTime(s,a,this._rampTimeConstant),this.context.rawContext.listener.upY.setTargetAtTime(n,a,this._rampTimeConstant),this.context.rawContext.listener.upZ.setTargetAtTime(o,a,this._rampTimeConstant)}else this.context.rawContext.listener.setOrientation(t,e,i,s,n,o);return this._orientation=Array.prototype.slice.call(arguments),this},Object.defineProperty(s.default.Listener.prototype,"positionX",{set:function(t){this._position[0]=t,this.setPosition.apply(this,this._position)},get:function(){return this._position[0]}}),Object.defineProperty(s.default.Listener.prototype,"positionY",{set:function(t){this._position[1]=t,this.setPosition.apply(this,this._position)},get:function(){return this._position[1]}}),Object.defineProperty(s.default.Listener.prototype,"positionZ",{set:function(t){this._position[2]=t,this.setPosition.apply(this,this._position)},get:function(){return this._position[2]}}),Object.defineProperty(s.default.Listener.prototype,"forwardX",{set:function(t){this._orientation[0]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[0]}}),Object.defineProperty(s.default.Listener.prototype,"forwardY",{set:function(t){this._orientation[1]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[1]}}),Object.defineProperty(s.default.Listener.prototype,"forwardZ",{set:function(t){this._orientation[2]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[2]}}),Object.defineProperty(s.default.Listener.prototype,"upX",{set:function(t){this._orientation[3]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[3]}}),Object.defineProperty(s.default.Listener.prototype,"upY",{set:function(t){this._orientation[4]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[4]}}),Object.defineProperty(s.default.Listener.prototype,"upZ",{set:function(t){this._orientation[5]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[5]}}),s.default.Listener.prototype.dispose=function(){return this._orientation=null,this._position=null,this};var n=s.default.Listener;s.default.Listener=new n,s.default.Context.on("init",function(t){t.listener&&t.listener.isListener?s.default.Listener=t.listener:s.default.Listener=new n}),e.default=s.default.Listener},function(t,e,i){"use strict";i.r(e);var s=i(0);i(24);s.default.Draw=function(){s.default.call(this),this._events=new s.default.Timeline,this.expiration=.25,this.anticipation=.008,this._boundDrawLoop=this._drawLoop.bind(this)},s.default.extend(s.default.Draw),s.default.Draw.prototype.schedule=function(t,e){return this._events.add({callback:t,time:this.toSeconds(e)}),1===this._events.length&&requestAnimationFrame(this._boundDrawLoop),this},s.default.Draw.prototype.cancel=function(t){return this._events.cancel(this.toSeconds(t)),this},s.default.Draw.prototype._drawLoop=function(){for(var t=s.default.context.currentTime;this._events.length&&this._events.peek().time-this.anticipation<=t;){var e=this._events.shift();t-e.time<=this.expiration&&e.callback()}this._events.length>0&&requestAnimationFrame(this._boundDrawLoop)},s.default.Draw=new s.default.Draw,e.default=s.default.Draw},function(t,e,i){"use strict";i.r(e);var s=i(0),n=(i(3),{});s.default.prototype.send=function(t,e){n.hasOwnProperty(t)||(n[t]=this.context.createGain()),e=s.default.defaultArg(e,0);var i=new s.default.Gain(e,s.default.Type.Decibels);return this.connect(i),i.connect(n[t]),i},s.default.prototype.receive=function(t,e){return n.hasOwnProperty(t)||(n[t]=this.context.createGain()),s.default.connect(n[t],this,0,e),this},s.default.Context.on("init",function(t){t.buses?n=t.buses:(n={},t.buses=n)}),e.default=s.default},function(t,e,i){"use strict";i.r(e);var s=i(0);i(4);s.default.CtrlRandom=function(){var t=s.default.defaults(arguments,["min","max"],s.default.CtrlRandom);s.default.call(this),this.min=t.min,this.max=t.max,this.integer=t.integer},s.default.extend(s.default.CtrlRandom),s.default.CtrlRandom.defaults={min:0,max:1,integer:!1},Object.defineProperty(s.default.CtrlRandom.prototype,"value",{get:function(){var t=this.toSeconds(this.min),e=this.toSeconds(this.max),i=Math.random(),s=i*t+(1-i)*e;return this.integer&&(s=Math.floor(s)),s}}),e.default=s.default.CtrlRandom},function(t,e,i){"use strict";i.r(e);var s=i(0);s.default.CtrlMarkov=function(t,e){s.default.call(this),this.values=s.default.defaultArg(t,{}),this.value=s.default.defaultArg(e,Object.keys(this.values)[0])},s.default.extend(s.default.CtrlMarkov),s.default.CtrlMarkov.prototype.next=function(){if(this.values.hasOwnProperty(this.value)){var t=this.values[this.value];if(s.default.isArray(t))for(var e=this._getProbDistribution(t),i=Math.random(),n=0,o=0;o<e.length;o++){var a=e[o];if(i>n&&i<n+a){var r=t[o];s.default.isObject(r)?this.value=r.value:this.value=r}n+=a}else this.value=t}return this.value},s.default.CtrlMarkov.prototype._getProbDistribution=function(t){for(var e=[],i=0,n=!1,o=0;o<t.length;o++){var a=t[o];s.default.isObject(a)?(n=!0,e[o]=a.probability):e[o]=1/t.length,i+=e[o]}if(n)for(var r=0;r<e.length;r++)e[r]=e[r]/i;return e},s.default.CtrlMarkov.prototype.dispose=function(){this.values=null},e.default=s.default.CtrlMarkov},function(t,e,i){"use strict";i.r(e);var s=i(0);i(4);s.default.CtrlInterpolate=function(){var t=s.default.defaults(arguments,["values","index"],s.default.CtrlInterpolate);s.default.call(this),this.values=t.values,this.index=t.index},s.default.extend(s.default.CtrlInterpolate),s.default.CtrlInterpolate.defaults={index:0,values:[]},Object.defineProperty(s.default.CtrlInterpolate.prototype,"value",{get:function(){var t=this.index;t=Math.min(t,this.values.length-1);var e=Math.floor(t),i=this.values[e],s=this.values[Math.ceil(t)];return this._interpolate(t-e,i,s)}}),s.default.CtrlInterpolate.prototype._interpolate=function(t,e,i){if(s.default.isArray(e)){for(var n=[],o=0;o<e.length;o++)n[o]=this._interpolate(t,e[o],i[o]);return n}if(s.default.isObject(e)){var a={};for(var r in e)a[r]=this._interpolate(t,e[r],i[r]);return a}return(1-t)*(e=this._toNumber(e))+t*(i=this._toNumber(i))},s.default.CtrlInterpolate.prototype._toNumber=function(t){return s.default.isNumber(t)?t:this.toSeconds(t)},s.default.CtrlInterpolate.prototype.dispose=function(){this.values=null},e.default=s.default.CtrlInterpolate},function(t,e,i){"use strict";i.r(e);var s=i(0);i(36),i(1);s.default.Waveform=function(){var t=s.default.defaults(arguments,["size"],s.default.Waveform);t.type=s.default.Analyser.Type.Waveform,s.default.AudioNode.call(this),this._analyser=this.input=this.output=new s.default.Analyser(t)},s.default.extend(s.default.Waveform,s.default.AudioNode),s.default.Waveform.defaults={size:1024},s.default.Waveform.prototype.getValue=function(){return this._analyser.getValue()},Object.defineProperty(s.default.Waveform.prototype,"size",{get:function(){return this._analyser.size},set:function(t){this._analyser.size=t}}),s.default.Waveform.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._analyser.dispose(),this._analyser=null},e.default=s.default.Waveform},function(t,e,i){"use strict";i.r(e);var s=i(0);i(23),i(10),i(19),i(2),i(22),i(28),i(1);s.default.Panner3D=function(){var t=s.default.defaults(arguments,["positionX","positionY","positionZ"],s.default.Panner3D);s.default.AudioNode.call(this),this._panner=this.input=this.output=this.context.createPanner(),this._panner.panningModel=t.panningModel,this._panner.maxDistance=t.maxDistance,this._panner.distanceModel=t.distanceModel,this._panner.coneOuterGain=t.coneOuterGain,this._panner.coneOuterAngle=t.coneOuterAngle,this._panner.coneInnerAngle=t.coneInnerAngle,this._panner.refDistance=t.refDistance,this._panner.rolloffFactor=t.rolloffFactor,this._orientation=[t.orientationX,t.orientationY,t.orientationZ],this._position=[t.positionX,t.positionY,t.positionZ],this.orientationX=t.orientationX,this.orientationY=t.orientationY,this.orientationZ=t.orientationZ,this.positionX=t.positionX,this.positionY=t.positionY,this.positionZ=t.positionZ},s.default.extend(s.default.Panner3D,s.default.AudioNode),s.default.Panner3D.defaults={positionX:0,positionY:0,positionZ:0,orientationX:0,orientationY:0,orientationZ:0,panningModel:"equalpower",maxDistance:1e4,distanceModel:"inverse",coneOuterGain:0,coneOuterAngle:360,coneInnerAngle:360,refDistance:1,rolloffFactor:1},s.default.Panner3D.prototype._rampTimeConstant=.01,s.default.Panner3D.prototype.setPosition=function(t,e,i){if(this._panner.positionX){var s=this.now();this._panner.positionX.setTargetAtTime(t,s,this._rampTimeConstant),this._panner.positionY.setTargetAtTime(e,s,this._rampTimeConstant),this._panner.positionZ.setTargetAtTime(i,s,this._rampTimeConstant)}else this._panner.setPosition(t,e,i);return this._position=Array.prototype.slice.call(arguments),this},s.default.Panner3D.prototype.setOrientation=function(t,e,i){if(this._panner.orientationX){var s=this.now();this._panner.orientationX.setTargetAtTime(t,s,this._rampTimeConstant),this._panner.orientationY.setTargetAtTime(e,s,this._rampTimeConstant),this._panner.orientationZ.setTargetAtTime(i,s,this._rampTimeConstant)}else this._panner.setOrientation(t,e,i);return this._orientation=Array.prototype.slice.call(arguments),this},Object.defineProperty(s.default.Panner3D.prototype,"positionX",{set:function(t){this._position[0]=t,this.setPosition.apply(this,this._position)},get:function(){return this._position[0]}}),Object.defineProperty(s.default.Panner3D.prototype,"positionY",{set:function(t){this._position[1]=t,this.setPosition.apply(this,this._position)},get:function(){return this._position[1]}}),Object.defineProperty(s.default.Panner3D.prototype,"positionZ",{set:function(t){this._position[2]=t,this.setPosition.apply(this,this._position)},get:function(){return this._position[2]}}),Object.defineProperty(s.default.Panner3D.prototype,"orientationX",{set:function(t){this._orientation[0]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[0]}}),Object.defineProperty(s.default.Panner3D.prototype,"orientationY",{set:function(t){this._orientation[1]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[1]}}),Object.defineProperty(s.default.Panner3D.prototype,"orientationZ",{set:function(t){this._orientation[2]=t,this.setOrientation.apply(this,this._orientation)},get:function(){return this._orientation[2]}}),s.default.Panner3D._aliasProperty=function(t){Object.defineProperty(s.default.Panner3D.prototype,t,{set:function(e){this._panner[t]=e},get:function(){return this._panner[t]}})},s.default.Panner3D._aliasProperty("panningModel"),s.default.Panner3D._aliasProperty("refDistance"),s.default.Panner3D._aliasProperty("rolloffFactor"),s.default.Panner3D._aliasProperty("distanceModel"),s.default.Panner3D._aliasProperty("coneInnerAngle"),s.default.Panner3D._aliasProperty("coneOuterAngle"),s.default.Panner3D._aliasProperty("coneOuterGain"),s.default.Panner3D._aliasProperty("maxDistance"),s.default.Panner3D.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._panner.disconnect(),this._panner=null,this._orientation=null,this._position=null,this},e.default=s.default.Panner3D},function(t,e,i){"use strict";i.r(e);var s=i(0);i(60),i(43),i(1);s.default.MultibandCompressor=function(t){s.default.AudioNode.call(this),t=s.default.defaultArg(arguments,s.default.MultibandCompressor.defaults),this._splitter=this.input=new s.default.MultibandSplit({lowFrequency:t.lowFrequency,highFrequency:t.highFrequency}),this.lowFrequency=this._splitter.lowFrequency,this.highFrequency=this._splitter.highFrequency,this.output=new s.default.Gain,this.low=new s.default.Compressor(t.low),this.mid=new s.default.Compressor(t.mid),this.high=new s.default.Compressor(t.high),this._splitter.low.chain(this.low,this.output),this._splitter.mid.chain(this.mid,this.output),this._splitter.high.chain(this.high,this.output),this._readOnly(["high","mid","low","highFrequency","lowFrequency"])},s.default.extend(s.default.MultibandCompressor,s.default.AudioNode),s.default.MultibandCompressor.defaults={low:s.default.Compressor.defaults,mid:s.default.Compressor.defaults,high:s.default.Compressor.defaults,lowFrequency:250,highFrequency:2e3},s.default.MultibandCompressor.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._splitter.dispose(),this._writable(["high","mid","low","highFrequency","lowFrequency"]),this.low.dispose(),this.mid.dispose(),this.high.dispose(),this._splitter=null,this.low=null,this.mid=null,this.high=null,this.lowFrequency=null,this.highFrequency=null,this},e.default=s.default.MultibandCompressor},function(t,e,i){"use strict";i.r(e);var s=i(0);i(10),i(1);s.default.Mono=function(){s.default.AudioNode.call(this),this.createInsOuts(1,0),this._merge=this.output=new s.default.Merge,s.default.connect(this.input,this._merge,0,0),s.default.connect(this.input,this._merge,0,1)},s.default.extend(s.default.Mono,s.default.AudioNode),s.default.Mono.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._merge.dispose(),this._merge=null,this},e.default=s.default.Mono},function(t,e,i){"use strict";i.r(e);var s=i(0);i(53),i(52),i(43),i(1);s.default.MidSideCompressor=function(t){s.default.AudioNode.call(this),t=s.default.defaultArg(t,s.default.MidSideCompressor.defaults),this._midSideSplit=this.input=new s.default.MidSideSplit,this._midSideMerge=this.output=new s.default.MidSideMerge,this.mid=new s.default.Compressor(t.mid),this.side=new s.default.Compressor(t.side),this._midSideSplit.mid.chain(this.mid,this._midSideMerge.mid),this._midSideSplit.side.chain(this.side,this._midSideMerge.side),this._readOnly(["mid","side"])},s.default.extend(s.default.MidSideCompressor,s.default.AudioNode),s.default.MidSideCompressor.defaults={mid:{ratio:3,threshold:-24,release:.03,attack:.02,knee:16},side:{ratio:6,threshold:-30,release:.25,attack:.03,knee:10}},s.default.MidSideCompressor.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["mid","side"]),this.mid.dispose(),this.mid=null,this.side.dispose(),this.side=null,this._midSideSplit.dispose(),this._midSideSplit=null,this._midSideMerge.dispose(),this._midSideMerge=null,this},e.default=s.default.MidSideCompressor},function(t,e,i){"use strict";i.r(e);var s=i(0);i(36),i(1);s.default.Meter=function(){var t=s.default.defaults(arguments,["smoothing"],s.default.Meter);s.default.AudioNode.call(this),this.smoothing=t.smoothing,this._rms=0,this.input=this.output=this._analyser=new s.default.Analyser("waveform",256)},s.default.extend(s.default.Meter,s.default.AudioNode),s.default.Meter.defaults={smoothing:.8},s.default.Meter.prototype.getLevel=function(){for(var t=this._analyser.getValue(),e=0,i=0;i<t.length;i++){var n=t[i];e+=n*n}var o=Math.sqrt(e/t.length);return this._rms=Math.max(o,this._rms*this.smoothing),s.default.gainToDb(this._rms)},s.default.Meter.prototype.getValue=function(){return this._analyser.getValue()[0]},s.default.Meter.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._analyser.dispose(),this._analyser=null,this},e.default=s.default.Meter},function(t,e,i){"use strict";i.r(e);var s=i(0);i(43),i(1);s.default.Limiter=function(){var t=s.default.defaults(arguments,["threshold"],s.default.Limiter);s.default.AudioNode.call(this),this._compressor=this.input=this.output=new s.default.Compressor({attack:.001,decay:.001,threshold:t.threshold}),this.threshold=this._compressor.threshold,this._readOnly("threshold")},s.default.extend(s.default.Limiter,s.default.AudioNode),s.default.Limiter.defaults={threshold:-12},s.default.Limiter.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._compressor.dispose(),this._compressor=null,this._writable("threshold"),this.threshold=null,this},e.default=s.default.Limiter},function(t,e,i){"use strict";i.r(e);var s=i(0);i(58),i(85),i(1);s.default.Gate=function(){var t=s.default.defaults(arguments,["threshold","smoothing"],s.default.Gate);s.default.AudioNode.call(this),this.createInsOuts(1,1),this._follower=new s.default.Follower(t.smoothing),this._gt=new s.default.GreaterThan(s.default.dbToGain(t.threshold)),s.default.connect(this.input,this.output),s.default.connectSeries(this.input,this._follower,this._gt,this.output.gain)},s.default.extend(s.default.Gate,s.default.AudioNode),s.default.Gate.defaults={smoothing:.1,threshold:-40},Object.defineProperty(s.default.Gate.prototype,"threshold",{get:function(){return s.default.gainToDb(this._gt.value)},set:function(t){this._gt.value=s.default.dbToGain(t)}}),Object.defineProperty(s.default.Gate.prototype,"smoothing",{get:function(){return this._follower.smoothing},set:function(t){this._follower.smoothing=t}}),s.default.Gate.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._follower.dispose(),this._gt.dispose(),this._follower=null,this._gt=null,this},e.default=s.default.Gate},function(t,e,i){"use strict";i.r(e);var s=i(0);i(36),i(1);s.default.FFT=function(){var t=s.default.defaults(arguments,["size"],s.default.FFT);t.type=s.default.Analyser.Type.FFT,s.default.AudioNode.call(this),this._analyser=this.input=this.output=new s.default.Analyser(t)},s.default.extend(s.default.FFT,s.default.AudioNode),s.default.FFT.defaults={size:1024},s.default.FFT.prototype.getValue=function(){return this._analyser.getValue()},Object.defineProperty(s.default.FFT.prototype,"size",{get:function(){return this._analyser.size},set:function(t){this._analyser.size=t}}),s.default.FFT.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._analyser.dispose(),this._analyser=null},e.default=s.default.FFT},function(t,e,i){"use strict";i.r(e);var s=i(0);i(60),i(3),i(1);s.default.EQ3=function(){var t=s.default.defaults(arguments,["low","mid","high"],s.default.EQ3);s.default.AudioNode.call(this),this.output=new s.default.Gain,this._multibandSplit=this.input=new s.default.MultibandSplit({lowFrequency:t.lowFrequency,highFrequency:t.highFrequency}),this._lowGain=new s.default.Gain(t.low,s.default.Type.Decibels),this._midGain=new s.default.Gain(t.mid,s.default.Type.Decibels),this._highGain=new s.default.Gain(t.high,s.default.Type.Decibels),this.low=this._lowGain.gain,this.mid=this._midGain.gain,this.high=this._highGain.gain,this.Q=this._multibandSplit.Q,this.lowFrequency=this._multibandSplit.lowFrequency,this.highFrequency=this._multibandSplit.highFrequency,this._multibandSplit.low.chain(this._lowGain,this.output),this._multibandSplit.mid.chain(this._midGain,this.output),this._multibandSplit.high.chain(this._highGain,this.output),this._readOnly(["low","mid","high","lowFrequency","highFrequency"])},s.default.extend(s.default.EQ3,s.default.AudioNode),s.default.EQ3.defaults={low:0,mid:0,high:0,lowFrequency:400,highFrequency:2500},s.default.EQ3.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["low","mid","high","lowFrequency","highFrequency"]),this._multibandSplit.dispose(),this._multibandSplit=null,this.lowFrequency=null,this.highFrequency=null,this._lowGain.dispose(),this._lowGain=null,this._midGain.dispose(),this._midGain=null,this._highGain.dispose(),this._highGain=null,this.low=null,this.mid=null,this.high=null,this.Q=null,this},e.default=s.default.EQ3},function(t,e,i){"use strict";i.r(e);var s=i(0);i(91),i(88),i(1);s.default.Channel=function(){var t=s.default.defaults(arguments,["volume","pan"],s.default.PanVol);s.default.AudioNode.call(this,t),this._solo=this.input=new s.default.Solo(t.solo),this._panVol=this.output=new s.default.PanVol({pan:t.pan,volume:t.volume,mute:t.mute}),this.pan=this._panVol.pan,this.volume=this._panVol.volume,this._solo.connect(this._panVol),this._readOnly(["pan","volume"])},s.default.extend(s.default.Channel,s.default.AudioNode),s.default.Channel.defaults={pan:0,volume:0,mute:!1,solo:!1},Object.defineProperty(s.default.Channel.prototype,"solo",{get:function(){return this._solo.solo},set:function(t){this._solo.solo=t}}),Object.defineProperty(s.default.Channel.prototype,"muted",{get:function(){return this._solo.muted||this.mute}}),Object.defineProperty(s.default.Channel.prototype,"mute",{get:function(){return this._panVol.mute},set:function(t){this._panVol.mute=t}}),s.default.Channel.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["pan","volume"]),this._panVol.dispose(),this._panVol=null,this.pan=null,this.volume=null,this._solo.dispose(),this._solo=null,this},e.default=s.default.Channel},function(t,e){var i;i=function(){return this}();try{i=i||Function("return this")()||(0,eval)("this")}catch(t){"object"==typeof window&&(i=window)}t.exports=i},function(t,e,i){i(31),i(36),i(146),i(43),i(23),i(47),i(145),i(59),i(144),i(9),i(58),i(41),i(143),i(12),i(142),i(54),i(10),i(141),i(140),i(52),i(53),i(139),i(138),i(60),i(48),i(137),i(91),i(86),i(88),i(19),i(27),i(136),i(135),i(134),i(79),i(133),i(1),i(11),i(78),i(132),i(83),i(20),i(18),i(131),i(35),i(3),i(81),i(130),i(40),i(77),i(76),i(14),i(24),i(34),i(16),i(56),i(80),i(129),i(128),i(127),i(126),i(125),i(124),i(74),i(123),i(8),i(122),i(33),i(121),i(120),i(73),i(119),i(118),i(117),i(116),i(15),i(115),i(114),i(72),i(113),i(112),i(51),i(71),i(70),i(111),i(110),i(109),i(108),i(107),i(21),i(106),i(105),i(25),i(66),i(104),i(103),i(102),i(101),i(38),i(87),i(29),i(22),i(89),i(100),i(85),i(84),i(75),i(5),i(90),i(99),i(61),i(26),i(42),i(2),i(30),i(13),i(82),i(98),i(7),i(28),i(68),i(32),i(67),i(49),i(97),i(39),i(37),i(17),i(64),i(65),i(96),i(50),i(69),i(6),i(57),i(95),i(46),i(94),i(55),i(63),i(62),i(45),i(4),t.exports=i(0).default}])});

},{}],4:[function(require,module,exports){
module.exports = {
    wavFromBuffer: wavFromBuffer
};


function wavFromBuffer(buffer) {
    let outputState = {
        recLength: 0,
        recBuffersL: [],
        recBuffersR: [],
        sampleRate:  44100
    };
    let bufArr = [buffer.getChannelData(0), buffer.getChannelData(1)];
    record(bufArr, outputState);
    let blob = exportWAV("audio/wav", outputState);
    return blob;
}


function record(inputBuffer, state) {
    state.recBuffersL.push(inputBuffer[0]);
    state.recBuffersR.push(inputBuffer[1]);
    state.recLength += inputBuffer[0].length;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i += 1) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output, offset, input) {
    let writeOffset = offset;
    for (let i = 0; i < input.length; i += 1, writeOffset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(writeOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function encodeWAV(samples, mono = false, state) {
    const buffer = new ArrayBuffer(44 + (samples.length * 2));
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 32 + (samples.length * 2), true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, mono ? 1 : 2, true);
    /* sample rate */
    view.setUint32(24, state.sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, state.sampleRate * 4, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 4, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return view;
}

function mergeBuffers(recBuffers, length) {
    const result = new Float32Array(length);
    let offset = 0;

    for (let i = 0; i < recBuffers.length; i += 1) {
        result.set(recBuffers[i], offset);
        offset += recBuffers[i].length;
    }
    return result;
}

function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);

    let index = 0;
    let inputIndex = 0;

    while (index < length) {
        result[index += 1] = inputL[inputIndex];
        result[index += 1] = inputR[inputIndex];
        inputIndex += 1;
    }

    return result;
}

function exportWAV(type, state) {

    const bufferL = mergeBuffers(state.recBuffersL, state.recLength);
    const bufferR = mergeBuffers(state.recBuffersR, state.recLength);
    const interleaved = interleave(bufferL, bufferR);
    const dataview = encodeWAV(interleaved, false, state);
    const audioBlob = new Blob([dataview], { type });


    return audioBlob;
}
},{}],5:[function(require,module,exports){

},{}],6:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],7:[function(require,module,exports){
"use strict";

var isValue         = require("type/value/is")
  , isPlainFunction = require("type/plain-function/is")
  , assign          = require("es5-ext/object/assign")
  , normalizeOpts   = require("es5-ext/object/normalize-options")
  , contains        = require("es5-ext/string/#/contains");

var d = (module.exports = function (dscr, value/*, options*/) {
	var c, e, w, options, desc;
	if (arguments.length < 2 || typeof dscr !== "string") {
		options = value;
		value = dscr;
		dscr = null;
	} else {
		options = arguments[2];
	}
	if (isValue(dscr)) {
		c = contains.call(dscr, "c");
		e = contains.call(dscr, "e");
		w = contains.call(dscr, "w");
	} else {
		c = w = true;
		e = false;
	}

	desc = { value: value, configurable: c, enumerable: e, writable: w };
	return !options ? desc : assign(normalizeOpts(options), desc);
});

d.gs = function (dscr, get, set/*, options*/) {
	var c, e, options, desc;
	if (typeof dscr !== "string") {
		options = set;
		set = get;
		get = dscr;
		dscr = null;
	} else {
		options = arguments[3];
	}
	if (!isValue(get)) {
		get = undefined;
	} else if (!isPlainFunction(get)) {
		options = get;
		get = set = undefined;
	} else if (!isValue(set)) {
		set = undefined;
	} else if (!isPlainFunction(set)) {
		options = set;
		set = undefined;
	}
	if (isValue(dscr)) {
		c = contains.call(dscr, "c");
		e = contains.call(dscr, "e");
	} else {
		c = true;
		e = false;
	}

	desc = { get: get, set: set, configurable: c, enumerable: e };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

},{"es5-ext/object/assign":9,"es5-ext/object/normalize-options":16,"es5-ext/string/#/contains":19,"type/plain-function/is":38,"type/value/is":40}],8:[function(require,module,exports){
"use strict";

// eslint-disable-next-line no-empty-function
module.exports = function () {};

},{}],9:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")() ? Object.assign : require("./shim");

},{"./is-implemented":10,"./shim":11}],10:[function(require,module,exports){
"use strict";

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== "function") return false;
	obj = { foo: "raz" };
	assign(obj, { bar: "dwa" }, { trzy: "trzy" });
	return obj.foo + obj.bar + obj.trzy === "razdwatrzy";
};

},{}],11:[function(require,module,exports){
"use strict";

var keys  = require("../keys")
  , value = require("../valid-value")
  , max   = Math.max;

module.exports = function (dest, src/*, …srcn*/) {
	var error, i, length = max(arguments.length, 2), assign;
	dest = Object(value(dest));
	assign = function (key) {
		try {
			dest[key] = src[key];
		} catch (e) {
			if (!error) error = e;
		}
	};
	for (i = 1; i < length; ++i) {
		src = arguments[i];
		keys(src).forEach(assign);
	}
	if (error !== undefined) throw error;
	return dest;
};

},{"../keys":13,"../valid-value":18}],12:[function(require,module,exports){
"use strict";

var _undefined = require("../function/noop")(); // Support ES3 engines

module.exports = function (val) { return val !== _undefined && val !== null; };

},{"../function/noop":8}],13:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")() ? Object.keys : require("./shim");

},{"./is-implemented":14,"./shim":15}],14:[function(require,module,exports){
"use strict";

module.exports = function () {
	try {
		Object.keys("primitive");
		return true;
	} catch (e) {
		return false;
	}
};

},{}],15:[function(require,module,exports){
"use strict";

var isValue = require("../is-value");

var keys = Object.keys;

module.exports = function (object) { return keys(isValue(object) ? Object(object) : object); };

},{"../is-value":12}],16:[function(require,module,exports){
"use strict";

var isValue = require("./is-value");

var forEach = Array.prototype.forEach, create = Object.create;

var process = function (src, obj) {
	var key;
	for (key in src) obj[key] = src[key];
};

// eslint-disable-next-line no-unused-vars
module.exports = function (opts1/*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (!isValue(options)) return;
		process(Object(options), result);
	});
	return result;
};

},{"./is-value":12}],17:[function(require,module,exports){
"use strict";

module.exports = function (fn) {
	if (typeof fn !== "function") throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],18:[function(require,module,exports){
"use strict";

var isValue = require("./is-value");

module.exports = function (value) {
	if (!isValue(value)) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{"./is-value":12}],19:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")() ? String.prototype.contains : require("./shim");

},{"./is-implemented":20,"./shim":21}],20:[function(require,module,exports){
"use strict";

var str = "razdwatrzy";

module.exports = function () {
	if (typeof str.contains !== "function") return false;
	return str.contains("dwa") === true && str.contains("foo") === false;
};

},{}],21:[function(require,module,exports){
"use strict";

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],22:[function(require,module,exports){
'use strict';

var OneVersionConstraint = require('individual/one-version');

var MY_VERSION = '7';
OneVersionConstraint('ev-store', MY_VERSION);

var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

module.exports = EvStore;

function EvStore(elem) {
    var hash = elem[hashKey];

    if (!hash) {
        hash = elem[hashKey] = {};
    }

    return hash;
}

},{"individual/one-version":28}],23:[function(require,module,exports){
'use strict';

var d        = require('d')
  , callable = require('es5-ext/object/valid-callable')

  , apply = Function.prototype.apply, call = Function.prototype.call
  , create = Object.create, defineProperty = Object.defineProperty
  , defineProperties = Object.defineProperties
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , descriptor = { configurable: true, enumerable: false, writable: true }

  , on, once, off, emit, methods, descriptors, base;

on = function (type, listener) {
	var data;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) {
		data = descriptor.value = create(null);
		defineProperty(this, '__ee__', descriptor);
		descriptor.value = null;
	} else {
		data = this.__ee__;
	}
	if (!data[type]) data[type] = listener;
	else if (typeof data[type] === 'object') data[type].push(listener);
	else data[type] = [data[type], listener];

	return this;
};

once = function (type, listener) {
	var once, self;

	callable(listener);
	self = this;
	on.call(this, type, once = function () {
		off.call(self, type, once);
		apply.call(listener, this, arguments);
	});

	once.__eeOnceListener__ = listener;
	return this;
};

off = function (type, listener) {
	var data, listeners, candidate, i;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) return this;
	data = this.__ee__;
	if (!data[type]) return this;
	listeners = data[type];

	if (typeof listeners === 'object') {
		for (i = 0; (candidate = listeners[i]); ++i) {
			if ((candidate === listener) ||
					(candidate.__eeOnceListener__ === listener)) {
				if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
				else listeners.splice(i, 1);
			}
		}
	} else {
		if ((listeners === listener) ||
				(listeners.__eeOnceListener__ === listener)) {
			delete data[type];
		}
	}

	return this;
};

emit = function (type) {
	var i, l, listener, listeners, args;

	if (!hasOwnProperty.call(this, '__ee__')) return;
	listeners = this.__ee__[type];
	if (!listeners) return;

	if (typeof listeners === 'object') {
		l = arguments.length;
		args = new Array(l - 1);
		for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

		listeners = listeners.slice();
		for (i = 0; (listener = listeners[i]); ++i) {
			apply.call(listener, this, args);
		}
	} else {
		switch (arguments.length) {
		case 1:
			call.call(listeners, this);
			break;
		case 2:
			call.call(listeners, this, arguments[1]);
			break;
		case 3:
			call.call(listeners, this, arguments[1], arguments[2]);
			break;
		default:
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) {
				args[i - 1] = arguments[i];
			}
			apply.call(listeners, this, args);
		}
	}
};

methods = {
	on: on,
	once: once,
	off: off,
	emit: emit
};

descriptors = {
	on: d(on),
	once: d(once),
	off: d(off),
	emit: d(emit)
};

base = defineProperties({}, descriptors);

module.exports = exports = function (o) {
	return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
};
exports.methods = methods;

},{"d":7,"es5-ext/object/valid-callable":17}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.linear = linear;
exports.exponential = exponential;
exports.sCurve = sCurve;
exports.logarithmic = logarithmic;
function linear(length, rotation) {
    var curve = new Float32Array(length),
        i,
        x,
        scale = length - 1;

    for (i = 0; i < length; i++) {
        x = i / scale;

        if (rotation > 0) {
            curve[i] = x;
        } else {
            curve[i] = 1 - x;
        }
    }

    return curve;
}

function exponential(length, rotation) {
    var curve = new Float32Array(length),
        i,
        x,
        scale = length - 1,
        index;

    for (i = 0; i < length; i++) {
        x = i / scale;
        index = rotation > 0 ? i : length - 1 - i;

        curve[index] = Math.exp(2 * x - 1) / Math.exp(1);
    }

    return curve;
}

//creating a curve to simulate an S-curve with setValueCurveAtTime.
function sCurve(length, rotation) {
    var curve = new Float32Array(length),
        i,
        phase = rotation > 0 ? Math.PI / 2 : -(Math.PI / 2);

    for (i = 0; i < length; ++i) {
        curve[i] = Math.sin(Math.PI * i / length - phase) / 2 + 0.5;
    }
    return curve;
}

//creating a curve to simulate a logarithmic curve with setValueCurveAtTime.
function logarithmic(length, base, rotation) {
    var curve = new Float32Array(length),
        index,
        x = 0,
        i;

    for (i = 0; i < length; i++) {
        //index for the curve array.
        index = rotation > 0 ? i : length - 1 - i;

        x = i / length;
        curve[index] = Math.log(1 + base * x) / Math.log(1 + base);
    }

    return curve;
}

},{}],25:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FADEOUT = exports.FADEIN = exports.LOGARITHMIC = exports.EXPONENTIAL = exports.LINEAR = exports.SCURVE = undefined;
exports.createFadeIn = createFadeIn;
exports.createFadeOut = createFadeOut;

var _fadeCurves = require('fade-curves');

var SCURVE = exports.SCURVE = "sCurve";
var LINEAR = exports.LINEAR = "linear";
var EXPONENTIAL = exports.EXPONENTIAL = "exponential";
var LOGARITHMIC = exports.LOGARITHMIC = "logarithmic";

var FADEIN = exports.FADEIN = "FadeIn";
var FADEOUT = exports.FADEOUT = "FadeOut";

function sCurveFadeIn(start, duration) {
    var curve = (0, _fadeCurves.sCurve)(10000, 1);
    this.setValueCurveAtTime(curve, start, duration);
}

function sCurveFadeOut(start, duration) {
    var curve = (0, _fadeCurves.sCurve)(10000, -1);
    this.setValueCurveAtTime(curve, start, duration);
}

function linearFadeIn(start, duration) {
    this.linearRampToValueAtTime(0, start);
    this.linearRampToValueAtTime(1, start + duration);
}

function linearFadeOut(start, duration) {
    this.linearRampToValueAtTime(1, start);
    this.linearRampToValueAtTime(0, start + duration);
}

function exponentialFadeIn(start, duration) {
    this.exponentialRampToValueAtTime(0.01, start);
    this.exponentialRampToValueAtTime(1, start + duration);
}

function exponentialFadeOut(start, duration) {
    this.exponentialRampToValueAtTime(1, start);
    this.exponentialRampToValueAtTime(0.01, start + duration);
}

function logarithmicFadeIn(start, duration) {
    var curve = (0, _fadeCurves.logarithmic)(10000, 10, 1);
    this.setValueCurveAtTime(curve, start, duration);
}

function logarithmicFadeOut(start, duration) {
    var curve = (0, _fadeCurves.logarithmic)(10000, 10, -1);
    this.setValueCurveAtTime(curve, start, duration);
}

function createFadeIn(gain, shape, start, duration) {
    switch (shape) {
        case SCURVE:
            sCurveFadeIn.call(gain, start, duration);
            break;
        case LINEAR:
            linearFadeIn.call(gain, start, duration);
            break;
        case EXPONENTIAL:
            exponentialFadeIn.call(gain, start, duration);
            break;
        case LOGARITHMIC:
            logarithmicFadeIn.call(gain, start, duration);
            break;
        default:
            throw new Error("Unsupported Fade type");
    }
}

function createFadeOut(gain, shape, start, duration) {
    switch (shape) {
        case SCURVE:
            sCurveFadeOut.call(gain, start, duration);
            break;
        case LINEAR:
            linearFadeOut.call(gain, start, duration);
            break;
        case EXPONENTIAL:
            exponentialFadeOut.call(gain, start, duration);
            break;
        case LOGARITHMIC:
            logarithmicFadeOut.call(gain, start, duration);
            break;
        default:
            throw new Error("Unsupported Fade type");
    }
}

},{"fade-curves":24}],26:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

var doccy;

if (typeof document !== 'undefined') {
    doccy = document;
} else {
    doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }
}

module.exports = doccy;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":5}],27:[function(require,module,exports){
(function (global){
'use strict';

/*global window, global*/

var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual;

function Individual(key, value) {
    if (key in root) {
        return root[key];
    }

    root[key] = value;

    return value;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],28:[function(require,module,exports){
'use strict';

var Individual = require('./index.js');

module.exports = OneVersion;

function OneVersion(moduleName, version, defaultValue) {
    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
    var enforceKey = key + '_ENFORCE_SINGLETON';

    var versionValue = Individual(enforceKey, version);

    if (versionValue !== version) {
        throw new Error('Can only have one copy of ' +
            moduleName + '.\n' +
            'You already have version ' + versionValue +
            ' installed.\n' +
            'This means you cannot install version ' + version);
    }

    return Individual(key, defaultValue);
}

},{"./index.js":27}],29:[function(require,module,exports){
(function (global){
var WORKER_ENABLED = !!(global === global.window && global.URL && global.Blob && global.Worker);

function InlineWorker(func, self) {
  var _this = this;
  var functionBody;

  self = self || {};

  if (WORKER_ENABLED) {
    functionBody = func.toString().trim().match(
      /^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/
    )[1];

    return new global.Worker(global.URL.createObjectURL(
      new global.Blob([ functionBody ], { type: "text/javascript" })
    ));
  }

  function postMessage(data) {
    setTimeout(function() {
      _this.onmessage({ data: data });
    }, 0);
  }

  this.self = self;
  this.self.postMessage = postMessage;

  setTimeout(func.bind(self, self), 0);
}

InlineWorker.prototype.postMessage = function postMessage(data) {
  var _this = this;

  setTimeout(function() {
    _this.self.onmessage({ data: data });
  }, 0);
};

module.exports = InlineWorker;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],30:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],31:[function(require,module,exports){
(function() {
  L.TileLayer.ColorPicker = L.TileLayer.extend({
    options: {
      crossOrigin: "anonymous"
    },
    getColor: function(latlng) {
      var size = this.getTileSize();
      var point = this._map.project(latlng, this._tileZoom).floor();
      var coords = point.unscaleBy(size).floor();
      var offset = point.subtract(coords.scaleBy(size));
      coords.z = this._tileZoom;
      var tile = this._tiles[this._tileCoordsToKey(coords)];
      if (!tile || !tile.loaded) return null;
      try {
        var canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        var context = canvas.getContext('2d');
        context.drawImage(tile.el, -offset.x, -offset.y, size.x, size.y);
        return context.getImageData(0, 0, 1, 1).data;
      } catch (e) {
        return null;
      }
    }
  });
  L.tileLayer.colorPicker = function(url, options) {
    return new L.TileLayer.ColorPicker(url, options);
  };
})();

},{}],32:[function(require,module,exports){
/* @preserve
 * Leaflet 1.5.1+build.2e3e0ff, a JS library for interactive maps. http://leafletjs.com
 * (c) 2010-2018 Vladimir Agafonkin, (c) 2010-2011 CloudMade
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.L = {})));
}(this, (function (exports) { 'use strict';

var version = "1.5.1+build.2e3e0ffb";

/*
 * @namespace Util
 *
 * Various utility functions, used by Leaflet internally.
 */

var freeze = Object.freeze;
Object.freeze = function (obj) { return obj; };

// @function extend(dest: Object, src?: Object): Object
// Merges the properties of the `src` object (or multiple objects) into `dest` object and returns the latter. Has an `L.extend` shortcut.
function extend(dest) {
	var i, j, len, src;

	for (j = 1, len = arguments.length; j < len; j++) {
		src = arguments[j];
		for (i in src) {
			dest[i] = src[i];
		}
	}
	return dest;
}

// @function create(proto: Object, properties?: Object): Object
// Compatibility polyfill for [Object.create](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/create)
var create = Object.create || (function () {
	function F() {}
	return function (proto) {
		F.prototype = proto;
		return new F();
	};
})();

// @function bind(fn: Function, …): Function
// Returns a new function bound to the arguments passed, like [Function.prototype.bind](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
// Has a `L.bind()` shortcut.
function bind(fn, obj) {
	var slice = Array.prototype.slice;

	if (fn.bind) {
		return fn.bind.apply(fn, slice.call(arguments, 1));
	}

	var args = slice.call(arguments, 2);

	return function () {
		return fn.apply(obj, args.length ? args.concat(slice.call(arguments)) : arguments);
	};
}

// @property lastId: Number
// Last unique ID used by [`stamp()`](#util-stamp)
var lastId = 0;

// @function stamp(obj: Object): Number
// Returns the unique ID of an object, assigning it one if it doesn't have it.
function stamp(obj) {
	/*eslint-disable */
	obj._leaflet_id = obj._leaflet_id || ++lastId;
	return obj._leaflet_id;
	/* eslint-enable */
}

// @function throttle(fn: Function, time: Number, context: Object): Function
// Returns a function which executes function `fn` with the given scope `context`
// (so that the `this` keyword refers to `context` inside `fn`'s code). The function
// `fn` will be called no more than one time per given amount of `time`. The arguments
// received by the bound function will be any arguments passed when binding the
// function, followed by any arguments passed when invoking the bound function.
// Has an `L.throttle` shortcut.
function throttle(fn, time, context) {
	var lock, args, wrapperFn, later;

	later = function () {
		// reset lock and call if queued
		lock = false;
		if (args) {
			wrapperFn.apply(context, args);
			args = false;
		}
	};

	wrapperFn = function () {
		if (lock) {
			// called too soon, queue to call later
			args = arguments;

		} else {
			// call and lock until later
			fn.apply(context, arguments);
			setTimeout(later, time);
			lock = true;
		}
	};

	return wrapperFn;
}

// @function wrapNum(num: Number, range: Number[], includeMax?: Boolean): Number
// Returns the number `num` modulo `range` in such a way so it lies within
// `range[0]` and `range[1]`. The returned value will be always smaller than
// `range[1]` unless `includeMax` is set to `true`.
function wrapNum(x, range, includeMax) {
	var max = range[1],
	    min = range[0],
	    d = max - min;
	return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
}

// @function falseFn(): Function
// Returns a function which always returns `false`.
function falseFn() { return false; }

// @function formatNum(num: Number, digits?: Number): Number
// Returns the number `num` rounded to `digits` decimals, or to 6 decimals by default.
function formatNum(num, digits) {
	digits = (digits === undefined ? 6 : digits);
	return +(Math.round(num + ('e+' + digits)) + ('e-' + digits));
}

// @function trim(str: String): String
// Compatibility polyfill for [String.prototype.trim](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/Trim)
function trim(str) {
	return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
}

// @function splitWords(str: String): String[]
// Trims and splits the string on whitespace and returns the array of parts.
function splitWords(str) {
	return trim(str).split(/\s+/);
}

// @function setOptions(obj: Object, options: Object): Object
// Merges the given properties to the `options` of the `obj` object, returning the resulting options. See `Class options`. Has an `L.setOptions` shortcut.
function setOptions(obj, options) {
	if (!obj.hasOwnProperty('options')) {
		obj.options = obj.options ? create(obj.options) : {};
	}
	for (var i in options) {
		obj.options[i] = options[i];
	}
	return obj.options;
}

// @function getParamString(obj: Object, existingUrl?: String, uppercase?: Boolean): String
// Converts an object into a parameter URL string, e.g. `{a: "foo", b: "bar"}`
// translates to `'?a=foo&b=bar'`. If `existingUrl` is set, the parameters will
// be appended at the end. If `uppercase` is `true`, the parameter names will
// be uppercased (e.g. `'?A=foo&B=bar'`)
function getParamString(obj, existingUrl, uppercase) {
	var params = [];
	for (var i in obj) {
		params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
	}
	return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
}

var templateRe = /\{ *([\w_-]+) *\}/g;

// @function template(str: String, data: Object): String
// Simple templating facility, accepts a template string of the form `'Hello {a}, {b}'`
// and a data object like `{a: 'foo', b: 'bar'}`, returns evaluated string
// `('Hello foo, bar')`. You can also specify functions instead of strings for
// data values — they will be evaluated passing `data` as an argument.
function template(str, data) {
	return str.replace(templateRe, function (str, key) {
		var value = data[key];

		if (value === undefined) {
			throw new Error('No value provided for variable ' + str);

		} else if (typeof value === 'function') {
			value = value(data);
		}
		return value;
	});
}

// @function isArray(obj): Boolean
// Compatibility polyfill for [Array.isArray](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray)
var isArray = Array.isArray || function (obj) {
	return (Object.prototype.toString.call(obj) === '[object Array]');
};

// @function indexOf(array: Array, el: Object): Number
// Compatibility polyfill for [Array.prototype.indexOf](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf)
function indexOf(array, el) {
	for (var i = 0; i < array.length; i++) {
		if (array[i] === el) { return i; }
	}
	return -1;
}

// @property emptyImageUrl: String
// Data URI string containing a base64-encoded empty GIF image.
// Used as a hack to free memory from unused images on WebKit-powered
// mobile devices (by setting image `src` to this string).
var emptyImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

// inspired by http://paulirish.com/2011/requestanimationframe-for-smart-animating/

function getPrefixed(name) {
	return window['webkit' + name] || window['moz' + name] || window['ms' + name];
}

var lastTime = 0;

// fallback for IE 7-8
function timeoutDefer(fn) {
	var time = +new Date(),
	    timeToCall = Math.max(0, 16 - (time - lastTime));

	lastTime = time + timeToCall;
	return window.setTimeout(fn, timeToCall);
}

var requestFn = window.requestAnimationFrame || getPrefixed('RequestAnimationFrame') || timeoutDefer;
var cancelFn = window.cancelAnimationFrame || getPrefixed('CancelAnimationFrame') ||
		getPrefixed('CancelRequestAnimationFrame') || function (id) { window.clearTimeout(id); };

// @function requestAnimFrame(fn: Function, context?: Object, immediate?: Boolean): Number
// Schedules `fn` to be executed when the browser repaints. `fn` is bound to
// `context` if given. When `immediate` is set, `fn` is called immediately if
// the browser doesn't have native support for
// [`window.requestAnimationFrame`](https://developer.mozilla.org/docs/Web/API/window/requestAnimationFrame),
// otherwise it's delayed. Returns a request ID that can be used to cancel the request.
function requestAnimFrame(fn, context, immediate) {
	if (immediate && requestFn === timeoutDefer) {
		fn.call(context);
	} else {
		return requestFn.call(window, bind(fn, context));
	}
}

// @function cancelAnimFrame(id: Number): undefined
// Cancels a previous `requestAnimFrame`. See also [window.cancelAnimationFrame](https://developer.mozilla.org/docs/Web/API/window/cancelAnimationFrame).
function cancelAnimFrame(id) {
	if (id) {
		cancelFn.call(window, id);
	}
}


var Util = (Object.freeze || Object)({
	freeze: freeze,
	extend: extend,
	create: create,
	bind: bind,
	lastId: lastId,
	stamp: stamp,
	throttle: throttle,
	wrapNum: wrapNum,
	falseFn: falseFn,
	formatNum: formatNum,
	trim: trim,
	splitWords: splitWords,
	setOptions: setOptions,
	getParamString: getParamString,
	template: template,
	isArray: isArray,
	indexOf: indexOf,
	emptyImageUrl: emptyImageUrl,
	requestFn: requestFn,
	cancelFn: cancelFn,
	requestAnimFrame: requestAnimFrame,
	cancelAnimFrame: cancelAnimFrame
});

// @class Class
// @aka L.Class

// @section
// @uninheritable

// Thanks to John Resig and Dean Edwards for inspiration!

function Class() {}

Class.extend = function (props) {

	// @function extend(props: Object): Function
	// [Extends the current class](#class-inheritance) given the properties to be included.
	// Returns a Javascript function that is a class constructor (to be called with `new`).
	var NewClass = function () {

		// call the constructor
		if (this.initialize) {
			this.initialize.apply(this, arguments);
		}

		// call all constructor hooks
		this.callInitHooks();
	};

	var parentProto = NewClass.__super__ = this.prototype;

	var proto = create(parentProto);
	proto.constructor = NewClass;

	NewClass.prototype = proto;

	// inherit parent's statics
	for (var i in this) {
		if (this.hasOwnProperty(i) && i !== 'prototype' && i !== '__super__') {
			NewClass[i] = this[i];
		}
	}

	// mix static properties into the class
	if (props.statics) {
		extend(NewClass, props.statics);
		delete props.statics;
	}

	// mix includes into the prototype
	if (props.includes) {
		checkDeprecatedMixinEvents(props.includes);
		extend.apply(null, [proto].concat(props.includes));
		delete props.includes;
	}

	// merge options
	if (proto.options) {
		props.options = extend(create(proto.options), props.options);
	}

	// mix given properties into the prototype
	extend(proto, props);

	proto._initHooks = [];

	// add method for calling all hooks
	proto.callInitHooks = function () {

		if (this._initHooksCalled) { return; }

		if (parentProto.callInitHooks) {
			parentProto.callInitHooks.call(this);
		}

		this._initHooksCalled = true;

		for (var i = 0, len = proto._initHooks.length; i < len; i++) {
			proto._initHooks[i].call(this);
		}
	};

	return NewClass;
};


// @function include(properties: Object): this
// [Includes a mixin](#class-includes) into the current class.
Class.include = function (props) {
	extend(this.prototype, props);
	return this;
};

// @function mergeOptions(options: Object): this
// [Merges `options`](#class-options) into the defaults of the class.
Class.mergeOptions = function (options) {
	extend(this.prototype.options, options);
	return this;
};

// @function addInitHook(fn: Function): this
// Adds a [constructor hook](#class-constructor-hooks) to the class.
Class.addInitHook = function (fn) { // (Function) || (String, args...)
	var args = Array.prototype.slice.call(arguments, 1);

	var init = typeof fn === 'function' ? fn : function () {
		this[fn].apply(this, args);
	};

	this.prototype._initHooks = this.prototype._initHooks || [];
	this.prototype._initHooks.push(init);
	return this;
};

function checkDeprecatedMixinEvents(includes) {
	if (typeof L === 'undefined' || !L || !L.Mixin) { return; }

	includes = isArray(includes) ? includes : [includes];

	for (var i = 0; i < includes.length; i++) {
		if (includes[i] === L.Mixin.Events) {
			console.warn('Deprecated include of L.Mixin.Events: ' +
				'this property will be removed in future releases, ' +
				'please inherit from L.Evented instead.', new Error().stack);
		}
	}
}

/*
 * @class Evented
 * @aka L.Evented
 * @inherits Class
 *
 * A set of methods shared between event-powered classes (like `Map` and `Marker`). Generally, events allow you to execute some function when something happens with an object (e.g. the user clicks on the map, causing the map to fire `'click'` event).
 *
 * @example
 *
 * ```js
 * map.on('click', function(e) {
 * 	alert(e.latlng);
 * } );
 * ```
 *
 * Leaflet deals with event listeners by reference, so if you want to add a listener and then remove it, define it as a function:
 *
 * ```js
 * function onClick(e) { ... }
 *
 * map.on('click', onClick);
 * map.off('click', onClick);
 * ```
 */

var Events = {
	/* @method on(type: String, fn: Function, context?: Object): this
	 * Adds a listener function (`fn`) to a particular event type of the object. You can optionally specify the context of the listener (object the this keyword will point to). You can also pass several space-separated types (e.g. `'click dblclick'`).
	 *
	 * @alternative
	 * @method on(eventMap: Object): this
	 * Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
	 */
	on: function (types, fn, context) {

		// types can be a map of types/handlers
		if (typeof types === 'object') {
			for (var type in types) {
				// we don't process space-separated events here for performance;
				// it's a hot path since Layer uses the on(obj) syntax
				this._on(type, types[type], fn);
			}

		} else {
			// types can be a string of space-separated words
			types = splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._on(types[i], fn, context);
			}
		}

		return this;
	},

	/* @method off(type: String, fn?: Function, context?: Object): this
	 * Removes a previously added listener function. If no function is specified, it will remove all the listeners of that particular event from the object. Note that if you passed a custom context to `on`, you must pass the same context to `off` in order to remove the listener.
	 *
	 * @alternative
	 * @method off(eventMap: Object): this
	 * Removes a set of type/listener pairs.
	 *
	 * @alternative
	 * @method off: this
	 * Removes all listeners to all events on the object. This includes implicitly attached events.
	 */
	off: function (types, fn, context) {

		if (!types) {
			// clear all listeners if called without arguments
			delete this._events;

		} else if (typeof types === 'object') {
			for (var type in types) {
				this._off(type, types[type], fn);
			}

		} else {
			types = splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._off(types[i], fn, context);
			}
		}

		return this;
	},

	// attach listener (without syntactic sugar now)
	_on: function (type, fn, context) {
		this._events = this._events || {};

		/* get/init listeners for type */
		var typeListeners = this._events[type];
		if (!typeListeners) {
			typeListeners = [];
			this._events[type] = typeListeners;
		}

		if (context === this) {
			// Less memory footprint.
			context = undefined;
		}
		var newListener = {fn: fn, ctx: context},
		    listeners = typeListeners;

		// check if fn already there
		for (var i = 0, len = listeners.length; i < len; i++) {
			if (listeners[i].fn === fn && listeners[i].ctx === context) {
				return;
			}
		}

		listeners.push(newListener);
	},

	_off: function (type, fn, context) {
		var listeners,
		    i,
		    len;

		if (!this._events) { return; }

		listeners = this._events[type];

		if (!listeners) {
			return;
		}

		if (!fn) {
			// Set all removed listeners to noop so they are not called if remove happens in fire
			for (i = 0, len = listeners.length; i < len; i++) {
				listeners[i].fn = falseFn;
			}
			// clear all listeners for a type if function isn't specified
			delete this._events[type];
			return;
		}

		if (context === this) {
			context = undefined;
		}

		if (listeners) {

			// find fn and remove it
			for (i = 0, len = listeners.length; i < len; i++) {
				var l = listeners[i];
				if (l.ctx !== context) { continue; }
				if (l.fn === fn) {

					// set the removed listener to noop so that's not called if remove happens in fire
					l.fn = falseFn;

					if (this._firingCount) {
						/* copy array in case events are being fired */
						this._events[type] = listeners = listeners.slice();
					}
					listeners.splice(i, 1);

					return;
				}
			}
		}
	},

	// @method fire(type: String, data?: Object, propagate?: Boolean): this
	// Fires an event of the specified type. You can optionally provide an data
	// object — the first argument of the listener function will contain its
	// properties. The event can optionally be propagated to event parents.
	fire: function (type, data, propagate) {
		if (!this.listens(type, propagate)) { return this; }

		var event = extend({}, data, {
			type: type,
			target: this,
			sourceTarget: data && data.sourceTarget || this
		});

		if (this._events) {
			var listeners = this._events[type];

			if (listeners) {
				this._firingCount = (this._firingCount + 1) || 1;
				for (var i = 0, len = listeners.length; i < len; i++) {
					var l = listeners[i];
					l.fn.call(l.ctx || this, event);
				}

				this._firingCount--;
			}
		}

		if (propagate) {
			// propagate the event to parents (set with addEventParent)
			this._propagateEvent(event);
		}

		return this;
	},

	// @method listens(type: String): Boolean
	// Returns `true` if a particular event type has any listeners attached to it.
	listens: function (type, propagate) {
		var listeners = this._events && this._events[type];
		if (listeners && listeners.length) { return true; }

		if (propagate) {
			// also check parents for listeners if event propagates
			for (var id in this._eventParents) {
				if (this._eventParents[id].listens(type, propagate)) { return true; }
			}
		}
		return false;
	},

	// @method once(…): this
	// Behaves as [`on(…)`](#evented-on), except the listener will only get fired once and then removed.
	once: function (types, fn, context) {

		if (typeof types === 'object') {
			for (var type in types) {
				this.once(type, types[type], fn);
			}
			return this;
		}

		var handler = bind(function () {
			this
			    .off(types, fn, context)
			    .off(types, handler, context);
		}, this);

		// add a listener that's executed once and removed after that
		return this
		    .on(types, fn, context)
		    .on(types, handler, context);
	},

	// @method addEventParent(obj: Evented): this
	// Adds an event parent - an `Evented` that will receive propagated events
	addEventParent: function (obj) {
		this._eventParents = this._eventParents || {};
		this._eventParents[stamp(obj)] = obj;
		return this;
	},

	// @method removeEventParent(obj: Evented): this
	// Removes an event parent, so it will stop receiving propagated events
	removeEventParent: function (obj) {
		if (this._eventParents) {
			delete this._eventParents[stamp(obj)];
		}
		return this;
	},

	_propagateEvent: function (e) {
		for (var id in this._eventParents) {
			this._eventParents[id].fire(e.type, extend({
				layer: e.target,
				propagatedFrom: e.target
			}, e), true);
		}
	}
};

// aliases; we should ditch those eventually

// @method addEventListener(…): this
// Alias to [`on(…)`](#evented-on)
Events.addEventListener = Events.on;

// @method removeEventListener(…): this
// Alias to [`off(…)`](#evented-off)

// @method clearAllEventListeners(…): this
// Alias to [`off()`](#evented-off)
Events.removeEventListener = Events.clearAllEventListeners = Events.off;

// @method addOneTimeEventListener(…): this
// Alias to [`once(…)`](#evented-once)
Events.addOneTimeEventListener = Events.once;

// @method fireEvent(…): this
// Alias to [`fire(…)`](#evented-fire)
Events.fireEvent = Events.fire;

// @method hasEventListeners(…): Boolean
// Alias to [`listens(…)`](#evented-listens)
Events.hasEventListeners = Events.listens;

var Evented = Class.extend(Events);

/*
 * @class Point
 * @aka L.Point
 *
 * Represents a point with `x` and `y` coordinates in pixels.
 *
 * @example
 *
 * ```js
 * var point = L.point(200, 300);
 * ```
 *
 * All Leaflet methods and options that accept `Point` objects also accept them in a simple Array form (unless noted otherwise), so these lines are equivalent:
 *
 * ```js
 * map.panBy([200, 300]);
 * map.panBy(L.point(200, 300));
 * ```
 *
 * Note that `Point` does not inherit from Leafet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

function Point(x, y, round) {
	// @property x: Number; The `x` coordinate of the point
	this.x = (round ? Math.round(x) : x);
	// @property y: Number; The `y` coordinate of the point
	this.y = (round ? Math.round(y) : y);
}

var trunc = Math.trunc || function (v) {
	return v > 0 ? Math.floor(v) : Math.ceil(v);
};

Point.prototype = {

	// @method clone(): Point
	// Returns a copy of the current point.
	clone: function () {
		return new Point(this.x, this.y);
	},

	// @method add(otherPoint: Point): Point
	// Returns the result of addition of the current and the given points.
	add: function (point) {
		// non-destructive, returns a new point
		return this.clone()._add(toPoint(point));
	},

	_add: function (point) {
		// destructive, used directly for performance in situations where it's safe to modify existing point
		this.x += point.x;
		this.y += point.y;
		return this;
	},

	// @method subtract(otherPoint: Point): Point
	// Returns the result of subtraction of the given point from the current.
	subtract: function (point) {
		return this.clone()._subtract(toPoint(point));
	},

	_subtract: function (point) {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	},

	// @method divideBy(num: Number): Point
	// Returns the result of division of the current point by the given number.
	divideBy: function (num) {
		return this.clone()._divideBy(num);
	},

	_divideBy: function (num) {
		this.x /= num;
		this.y /= num;
		return this;
	},

	// @method multiplyBy(num: Number): Point
	// Returns the result of multiplication of the current point by the given number.
	multiplyBy: function (num) {
		return this.clone()._multiplyBy(num);
	},

	_multiplyBy: function (num) {
		this.x *= num;
		this.y *= num;
		return this;
	},

	// @method scaleBy(scale: Point): Point
	// Multiply each coordinate of the current point by each coordinate of
	// `scale`. In linear algebra terms, multiply the point by the
	// [scaling matrix](https://en.wikipedia.org/wiki/Scaling_%28geometry%29#Matrix_representation)
	// defined by `scale`.
	scaleBy: function (point) {
		return new Point(this.x * point.x, this.y * point.y);
	},

	// @method unscaleBy(scale: Point): Point
	// Inverse of `scaleBy`. Divide each coordinate of the current point by
	// each coordinate of `scale`.
	unscaleBy: function (point) {
		return new Point(this.x / point.x, this.y / point.y);
	},

	// @method round(): Point
	// Returns a copy of the current point with rounded coordinates.
	round: function () {
		return this.clone()._round();
	},

	_round: function () {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	},

	// @method floor(): Point
	// Returns a copy of the current point with floored coordinates (rounded down).
	floor: function () {
		return this.clone()._floor();
	},

	_floor: function () {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	},

	// @method ceil(): Point
	// Returns a copy of the current point with ceiled coordinates (rounded up).
	ceil: function () {
		return this.clone()._ceil();
	},

	_ceil: function () {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	},

	// @method trunc(): Point
	// Returns a copy of the current point with truncated coordinates (rounded towards zero).
	trunc: function () {
		return this.clone()._trunc();
	},

	_trunc: function () {
		this.x = trunc(this.x);
		this.y = trunc(this.y);
		return this;
	},

	// @method distanceTo(otherPoint: Point): Number
	// Returns the cartesian distance between the current and the given points.
	distanceTo: function (point) {
		point = toPoint(point);

		var x = point.x - this.x,
		    y = point.y - this.y;

		return Math.sqrt(x * x + y * y);
	},

	// @method equals(otherPoint: Point): Boolean
	// Returns `true` if the given point has the same coordinates.
	equals: function (point) {
		point = toPoint(point);

		return point.x === this.x &&
		       point.y === this.y;
	},

	// @method contains(otherPoint: Point): Boolean
	// Returns `true` if both coordinates of the given point are less than the corresponding current point coordinates (in absolute values).
	contains: function (point) {
		point = toPoint(point);

		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	},

	// @method toString(): String
	// Returns a string representation of the point for debugging purposes.
	toString: function () {
		return 'Point(' +
		        formatNum(this.x) + ', ' +
		        formatNum(this.y) + ')';
	}
};

// @factory L.point(x: Number, y: Number, round?: Boolean)
// Creates a Point object with the given `x` and `y` coordinates. If optional `round` is set to true, rounds the `x` and `y` values.

// @alternative
// @factory L.point(coords: Number[])
// Expects an array of the form `[x, y]` instead.

// @alternative
// @factory L.point(coords: Object)
// Expects a plain object of the form `{x: Number, y: Number}` instead.
function toPoint(x, y, round) {
	if (x instanceof Point) {
		return x;
	}
	if (isArray(x)) {
		return new Point(x[0], x[1]);
	}
	if (x === undefined || x === null) {
		return x;
	}
	if (typeof x === 'object' && 'x' in x && 'y' in x) {
		return new Point(x.x, x.y);
	}
	return new Point(x, y, round);
}

/*
 * @class Bounds
 * @aka L.Bounds
 *
 * Represents a rectangular area in pixel coordinates.
 *
 * @example
 *
 * ```js
 * var p1 = L.point(10, 10),
 * p2 = L.point(40, 60),
 * bounds = L.bounds(p1, p2);
 * ```
 *
 * All Leaflet methods that accept `Bounds` objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * otherBounds.intersects([[10, 10], [40, 60]]);
 * ```
 *
 * Note that `Bounds` does not inherit from Leafet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

function Bounds(a, b) {
	if (!a) { return; }

	var points = b ? [a, b] : a;

	for (var i = 0, len = points.length; i < len; i++) {
		this.extend(points[i]);
	}
}

Bounds.prototype = {
	// @method extend(point: Point): this
	// Extends the bounds to contain the given point.
	extend: function (point) { // (Point)
		point = toPoint(point);

		// @property min: Point
		// The top left corner of the rectangle.
		// @property max: Point
		// The bottom right corner of the rectangle.
		if (!this.min && !this.max) {
			this.min = point.clone();
			this.max = point.clone();
		} else {
			this.min.x = Math.min(point.x, this.min.x);
			this.max.x = Math.max(point.x, this.max.x);
			this.min.y = Math.min(point.y, this.min.y);
			this.max.y = Math.max(point.y, this.max.y);
		}
		return this;
	},

	// @method getCenter(round?: Boolean): Point
	// Returns the center point of the bounds.
	getCenter: function (round) {
		return new Point(
		        (this.min.x + this.max.x) / 2,
		        (this.min.y + this.max.y) / 2, round);
	},

	// @method getBottomLeft(): Point
	// Returns the bottom-left point of the bounds.
	getBottomLeft: function () {
		return new Point(this.min.x, this.max.y);
	},

	// @method getTopRight(): Point
	// Returns the top-right point of the bounds.
	getTopRight: function () { // -> Point
		return new Point(this.max.x, this.min.y);
	},

	// @method getTopLeft(): Point
	// Returns the top-left point of the bounds (i.e. [`this.min`](#bounds-min)).
	getTopLeft: function () {
		return this.min; // left, top
	},

	// @method getBottomRight(): Point
	// Returns the bottom-right point of the bounds (i.e. [`this.max`](#bounds-max)).
	getBottomRight: function () {
		return this.max; // right, bottom
	},

	// @method getSize(): Point
	// Returns the size of the given bounds
	getSize: function () {
		return this.max.subtract(this.min);
	},

	// @method contains(otherBounds: Bounds): Boolean
	// Returns `true` if the rectangle contains the given one.
	// @alternative
	// @method contains(point: Point): Boolean
	// Returns `true` if the rectangle contains the given point.
	contains: function (obj) {
		var min, max;

		if (typeof obj[0] === 'number' || obj instanceof Point) {
			obj = toPoint(obj);
		} else {
			obj = toBounds(obj);
		}

		if (obj instanceof Bounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (min.x >= this.min.x) &&
		       (max.x <= this.max.x) &&
		       (min.y >= this.min.y) &&
		       (max.y <= this.max.y);
	},

	// @method intersects(otherBounds: Bounds): Boolean
	// Returns `true` if the rectangle intersects the given bounds. Two bounds
	// intersect if they have at least one point in common.
	intersects: function (bounds) { // (Bounds) -> Boolean
		bounds = toBounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	},

	// @method overlaps(otherBounds: Bounds): Boolean
	// Returns `true` if the rectangle overlaps the given bounds. Two bounds
	// overlap if their intersection is an area.
	overlaps: function (bounds) { // (Bounds) -> Boolean
		bounds = toBounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xOverlaps = (max2.x > min.x) && (min2.x < max.x),
		    yOverlaps = (max2.y > min.y) && (min2.y < max.y);

		return xOverlaps && yOverlaps;
	},

	isValid: function () {
		return !!(this.min && this.max);
	}
};


// @factory L.bounds(corner1: Point, corner2: Point)
// Creates a Bounds object from two corners coordinate pairs.
// @alternative
// @factory L.bounds(points: Point[])
// Creates a Bounds object from the given array of points.
function toBounds(a, b) {
	if (!a || a instanceof Bounds) {
		return a;
	}
	return new Bounds(a, b);
}

/*
 * @class LatLngBounds
 * @aka L.LatLngBounds
 *
 * Represents a rectangular geographical area on a map.
 *
 * @example
 *
 * ```js
 * var corner1 = L.latLng(40.712, -74.227),
 * corner2 = L.latLng(40.774, -74.125),
 * bounds = L.latLngBounds(corner1, corner2);
 * ```
 *
 * All Leaflet methods that accept LatLngBounds objects also accept them in a simple Array form (unless noted otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * map.fitBounds([
 * 	[40.712, -74.227],
 * 	[40.774, -74.125]
 * ]);
 * ```
 *
 * Caution: if the area crosses the antimeridian (often confused with the International Date Line), you must specify corners _outside_ the [-180, 180] degrees longitude range.
 *
 * Note that `LatLngBounds` does not inherit from Leafet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

function LatLngBounds(corner1, corner2) { // (LatLng, LatLng) or (LatLng[])
	if (!corner1) { return; }

	var latlngs = corner2 ? [corner1, corner2] : corner1;

	for (var i = 0, len = latlngs.length; i < len; i++) {
		this.extend(latlngs[i]);
	}
}

LatLngBounds.prototype = {

	// @method extend(latlng: LatLng): this
	// Extend the bounds to contain the given point

	// @alternative
	// @method extend(otherBounds: LatLngBounds): this
	// Extend the bounds to contain the given bounds
	extend: function (obj) {
		var sw = this._southWest,
		    ne = this._northEast,
		    sw2, ne2;

		if (obj instanceof LatLng) {
			sw2 = obj;
			ne2 = obj;

		} else if (obj instanceof LatLngBounds) {
			sw2 = obj._southWest;
			ne2 = obj._northEast;

			if (!sw2 || !ne2) { return this; }

		} else {
			return obj ? this.extend(toLatLng(obj) || toLatLngBounds(obj)) : this;
		}

		if (!sw && !ne) {
			this._southWest = new LatLng(sw2.lat, sw2.lng);
			this._northEast = new LatLng(ne2.lat, ne2.lng);
		} else {
			sw.lat = Math.min(sw2.lat, sw.lat);
			sw.lng = Math.min(sw2.lng, sw.lng);
			ne.lat = Math.max(ne2.lat, ne.lat);
			ne.lng = Math.max(ne2.lng, ne.lng);
		}

		return this;
	},

	// @method pad(bufferRatio: Number): LatLngBounds
	// Returns bounds created by extending or retracting the current bounds by a given ratio in each direction.
	// For example, a ratio of 0.5 extends the bounds by 50% in each direction.
	// Negative values will retract the bounds.
	pad: function (bufferRatio) {
		var sw = this._southWest,
		    ne = this._northEast,
		    heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
		    widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

		return new LatLngBounds(
		        new LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
		        new LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
	},

	// @method getCenter(): LatLng
	// Returns the center point of the bounds.
	getCenter: function () {
		return new LatLng(
		        (this._southWest.lat + this._northEast.lat) / 2,
		        (this._southWest.lng + this._northEast.lng) / 2);
	},

	// @method getSouthWest(): LatLng
	// Returns the south-west point of the bounds.
	getSouthWest: function () {
		return this._southWest;
	},

	// @method getNorthEast(): LatLng
	// Returns the north-east point of the bounds.
	getNorthEast: function () {
		return this._northEast;
	},

	// @method getNorthWest(): LatLng
	// Returns the north-west point of the bounds.
	getNorthWest: function () {
		return new LatLng(this.getNorth(), this.getWest());
	},

	// @method getSouthEast(): LatLng
	// Returns the south-east point of the bounds.
	getSouthEast: function () {
		return new LatLng(this.getSouth(), this.getEast());
	},

	// @method getWest(): Number
	// Returns the west longitude of the bounds
	getWest: function () {
		return this._southWest.lng;
	},

	// @method getSouth(): Number
	// Returns the south latitude of the bounds
	getSouth: function () {
		return this._southWest.lat;
	},

	// @method getEast(): Number
	// Returns the east longitude of the bounds
	getEast: function () {
		return this._northEast.lng;
	},

	// @method getNorth(): Number
	// Returns the north latitude of the bounds
	getNorth: function () {
		return this._northEast.lat;
	},

	// @method contains(otherBounds: LatLngBounds): Boolean
	// Returns `true` if the rectangle contains the given one.

	// @alternative
	// @method contains (latlng: LatLng): Boolean
	// Returns `true` if the rectangle contains the given point.
	contains: function (obj) { // (LatLngBounds) or (LatLng) -> Boolean
		if (typeof obj[0] === 'number' || obj instanceof LatLng || 'lat' in obj) {
			obj = toLatLng(obj);
		} else {
			obj = toLatLngBounds(obj);
		}

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2, ne2;

		if (obj instanceof LatLngBounds) {
			sw2 = obj.getSouthWest();
			ne2 = obj.getNorthEast();
		} else {
			sw2 = ne2 = obj;
		}

		return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
		       (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
	},

	// @method intersects(otherBounds: LatLngBounds): Boolean
	// Returns `true` if the rectangle intersects the given bounds. Two bounds intersect if they have at least one point in common.
	intersects: function (bounds) {
		bounds = toLatLngBounds(bounds);

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2 = bounds.getSouthWest(),
		    ne2 = bounds.getNorthEast(),

		    latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
		    lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

		return latIntersects && lngIntersects;
	},

	// @method overlaps(otherBounds: Bounds): Boolean
	// Returns `true` if the rectangle overlaps the given bounds. Two bounds overlap if their intersection is an area.
	overlaps: function (bounds) {
		bounds = toLatLngBounds(bounds);

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2 = bounds.getSouthWest(),
		    ne2 = bounds.getNorthEast(),

		    latOverlaps = (ne2.lat > sw.lat) && (sw2.lat < ne.lat),
		    lngOverlaps = (ne2.lng > sw.lng) && (sw2.lng < ne.lng);

		return latOverlaps && lngOverlaps;
	},

	// @method toBBoxString(): String
	// Returns a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat' format. Useful for sending requests to web services that return geo data.
	toBBoxString: function () {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	},

	// @method equals(otherBounds: LatLngBounds, maxMargin?: Number): Boolean
	// Returns `true` if the rectangle is equivalent (within a small margin of error) to the given bounds. The margin of error can be overridden by setting `maxMargin` to a small number.
	equals: function (bounds, maxMargin) {
		if (!bounds) { return false; }

		bounds = toLatLngBounds(bounds);

		return this._southWest.equals(bounds.getSouthWest(), maxMargin) &&
		       this._northEast.equals(bounds.getNorthEast(), maxMargin);
	},

	// @method isValid(): Boolean
	// Returns `true` if the bounds are properly initialized.
	isValid: function () {
		return !!(this._southWest && this._northEast);
	}
};

// TODO International date line?

// @factory L.latLngBounds(corner1: LatLng, corner2: LatLng)
// Creates a `LatLngBounds` object by defining two diagonally opposite corners of the rectangle.

// @alternative
// @factory L.latLngBounds(latlngs: LatLng[])
// Creates a `LatLngBounds` object defined by the geographical points it contains. Very useful for zooming the map to fit a particular set of locations with [`fitBounds`](#map-fitbounds).
function toLatLngBounds(a, b) {
	if (a instanceof LatLngBounds) {
		return a;
	}
	return new LatLngBounds(a, b);
}

/* @class LatLng
 * @aka L.LatLng
 *
 * Represents a geographical point with a certain latitude and longitude.
 *
 * @example
 *
 * ```
 * var latlng = L.latLng(50.5, 30.5);
 * ```
 *
 * All Leaflet methods that accept LatLng objects also accept them in a simple Array form and simple object form (unless noted otherwise), so these lines are equivalent:
 *
 * ```
 * map.panTo([50, 30]);
 * map.panTo({lon: 30, lat: 50});
 * map.panTo({lat: 50, lng: 30});
 * map.panTo(L.latLng(50, 30));
 * ```
 *
 * Note that `LatLng` does not inherit from Leaflet's `Class` object,
 * which means new classes can't inherit from it, and new methods
 * can't be added to it with the `include` function.
 */

function LatLng(lat, lng, alt) {
	if (isNaN(lat) || isNaN(lng)) {
		throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
	}

	// @property lat: Number
	// Latitude in degrees
	this.lat = +lat;

	// @property lng: Number
	// Longitude in degrees
	this.lng = +lng;

	// @property alt: Number
	// Altitude in meters (optional)
	if (alt !== undefined) {
		this.alt = +alt;
	}
}

LatLng.prototype = {
	// @method equals(otherLatLng: LatLng, maxMargin?: Number): Boolean
	// Returns `true` if the given `LatLng` point is at the same position (within a small margin of error). The margin of error can be overridden by setting `maxMargin` to a small number.
	equals: function (obj, maxMargin) {
		if (!obj) { return false; }

		obj = toLatLng(obj);

		var margin = Math.max(
		        Math.abs(this.lat - obj.lat),
		        Math.abs(this.lng - obj.lng));

		return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
	},

	// @method toString(): String
	// Returns a string representation of the point (for debugging purposes).
	toString: function (precision) {
		return 'LatLng(' +
		        formatNum(this.lat, precision) + ', ' +
		        formatNum(this.lng, precision) + ')';
	},

	// @method distanceTo(otherLatLng: LatLng): Number
	// Returns the distance (in meters) to the given `LatLng` calculated using the [Spherical Law of Cosines](https://en.wikipedia.org/wiki/Spherical_law_of_cosines).
	distanceTo: function (other) {
		return Earth.distance(this, toLatLng(other));
	},

	// @method wrap(): LatLng
	// Returns a new `LatLng` object with the longitude wrapped so it's always between -180 and +180 degrees.
	wrap: function () {
		return Earth.wrapLatLng(this);
	},

	// @method toBounds(sizeInMeters: Number): LatLngBounds
	// Returns a new `LatLngBounds` object in which each boundary is `sizeInMeters/2` meters apart from the `LatLng`.
	toBounds: function (sizeInMeters) {
		var latAccuracy = 180 * sizeInMeters / 40075017,
		    lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

		return toLatLngBounds(
		        [this.lat - latAccuracy, this.lng - lngAccuracy],
		        [this.lat + latAccuracy, this.lng + lngAccuracy]);
	},

	clone: function () {
		return new LatLng(this.lat, this.lng, this.alt);
	}
};



// @factory L.latLng(latitude: Number, longitude: Number, altitude?: Number): LatLng
// Creates an object representing a geographical point with the given latitude and longitude (and optionally altitude).

// @alternative
// @factory L.latLng(coords: Array): LatLng
// Expects an array of the form `[Number, Number]` or `[Number, Number, Number]` instead.

// @alternative
// @factory L.latLng(coords: Object): LatLng
// Expects an plain object of the form `{lat: Number, lng: Number}` or `{lat: Number, lng: Number, alt: Number}` instead.

function toLatLng(a, b, c) {
	if (a instanceof LatLng) {
		return a;
	}
	if (isArray(a) && typeof a[0] !== 'object') {
		if (a.length === 3) {
			return new LatLng(a[0], a[1], a[2]);
		}
		if (a.length === 2) {
			return new LatLng(a[0], a[1]);
		}
		return null;
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
	}
	if (b === undefined) {
		return null;
	}
	return new LatLng(a, b, c);
}

/*
 * @namespace CRS
 * @crs L.CRS.Base
 * Object that defines coordinate reference systems for projecting
 * geographical points into pixel (screen) coordinates and back (and to
 * coordinates in other units for [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services). See
 * [spatial reference system](http://en.wikipedia.org/wiki/Coordinate_reference_system).
 *
 * Leaflet defines the most usual CRSs by default. If you want to use a
 * CRS not defined by default, take a look at the
 * [Proj4Leaflet](https://github.com/kartena/Proj4Leaflet) plugin.
 *
 * Note that the CRS instances do not inherit from Leafet's `Class` object,
 * and can't be instantiated. Also, new classes can't inherit from them,
 * and methods can't be added to them with the `include` function.
 */

var CRS = {
	// @method latLngToPoint(latlng: LatLng, zoom: Number): Point
	// Projects geographical coordinates into pixel coordinates for a given zoom.
	latLngToPoint: function (latlng, zoom) {
		var projectedPoint = this.projection.project(latlng),
		    scale = this.scale(zoom);

		return this.transformation._transform(projectedPoint, scale);
	},

	// @method pointToLatLng(point: Point, zoom: Number): LatLng
	// The inverse of `latLngToPoint`. Projects pixel coordinates on a given
	// zoom into geographical coordinates.
	pointToLatLng: function (point, zoom) {
		var scale = this.scale(zoom),
		    untransformedPoint = this.transformation.untransform(point, scale);

		return this.projection.unproject(untransformedPoint);
	},

	// @method project(latlng: LatLng): Point
	// Projects geographical coordinates into coordinates in units accepted for
	// this CRS (e.g. meters for EPSG:3857, for passing it to WMS services).
	project: function (latlng) {
		return this.projection.project(latlng);
	},

	// @method unproject(point: Point): LatLng
	// Given a projected coordinate returns the corresponding LatLng.
	// The inverse of `project`.
	unproject: function (point) {
		return this.projection.unproject(point);
	},

	// @method scale(zoom: Number): Number
	// Returns the scale used when transforming projected coordinates into
	// pixel coordinates for a particular zoom. For example, it returns
	// `256 * 2^zoom` for Mercator-based CRS.
	scale: function (zoom) {
		return 256 * Math.pow(2, zoom);
	},

	// @method zoom(scale: Number): Number
	// Inverse of `scale()`, returns the zoom level corresponding to a scale
	// factor of `scale`.
	zoom: function (scale) {
		return Math.log(scale / 256) / Math.LN2;
	},

	// @method getProjectedBounds(zoom: Number): Bounds
	// Returns the projection's bounds scaled and transformed for the provided `zoom`.
	getProjectedBounds: function (zoom) {
		if (this.infinite) { return null; }

		var b = this.projection.bounds,
		    s = this.scale(zoom),
		    min = this.transformation.transform(b.min, s),
		    max = this.transformation.transform(b.max, s);

		return new Bounds(min, max);
	},

	// @method distance(latlng1: LatLng, latlng2: LatLng): Number
	// Returns the distance between two geographical coordinates.

	// @property code: String
	// Standard code name of the CRS passed into WMS services (e.g. `'EPSG:3857'`)
	//
	// @property wrapLng: Number[]
	// An array of two numbers defining whether the longitude (horizontal) coordinate
	// axis wraps around a given range and how. Defaults to `[-180, 180]` in most
	// geographical CRSs. If `undefined`, the longitude axis does not wrap around.
	//
	// @property wrapLat: Number[]
	// Like `wrapLng`, but for the latitude (vertical) axis.

	// wrapLng: [min, max],
	// wrapLat: [min, max],

	// @property infinite: Boolean
	// If true, the coordinate space will be unbounded (infinite in both axes)
	infinite: false,

	// @method wrapLatLng(latlng: LatLng): LatLng
	// Returns a `LatLng` where lat and lng has been wrapped according to the
	// CRS's `wrapLat` and `wrapLng` properties, if they are outside the CRS's bounds.
	wrapLatLng: function (latlng) {
		var lng = this.wrapLng ? wrapNum(latlng.lng, this.wrapLng, true) : latlng.lng,
		    lat = this.wrapLat ? wrapNum(latlng.lat, this.wrapLat, true) : latlng.lat,
		    alt = latlng.alt;

		return new LatLng(lat, lng, alt);
	},

	// @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
	// Returns a `LatLngBounds` with the same size as the given one, ensuring
	// that its center is within the CRS's bounds.
	// Only accepts actual `L.LatLngBounds` instances, not arrays.
	wrapLatLngBounds: function (bounds) {
		var center = bounds.getCenter(),
		    newCenter = this.wrapLatLng(center),
		    latShift = center.lat - newCenter.lat,
		    lngShift = center.lng - newCenter.lng;

		if (latShift === 0 && lngShift === 0) {
			return bounds;
		}

		var sw = bounds.getSouthWest(),
		    ne = bounds.getNorthEast(),
		    newSw = new LatLng(sw.lat - latShift, sw.lng - lngShift),
		    newNe = new LatLng(ne.lat - latShift, ne.lng - lngShift);

		return new LatLngBounds(newSw, newNe);
	}
};

/*
 * @namespace CRS
 * @crs L.CRS.Earth
 *
 * Serves as the base for CRS that are global such that they cover the earth.
 * Can only be used as the base for other CRS and cannot be used directly,
 * since it does not have a `code`, `projection` or `transformation`. `distance()` returns
 * meters.
 */

var Earth = extend({}, CRS, {
	wrapLng: [-180, 180],

	// Mean Earth Radius, as recommended for use by
	// the International Union of Geodesy and Geophysics,
	// see http://rosettacode.org/wiki/Haversine_formula
	R: 6371000,

	// distance between two geographical points using spherical law of cosines approximation
	distance: function (latlng1, latlng2) {
		var rad = Math.PI / 180,
		    lat1 = latlng1.lat * rad,
		    lat2 = latlng2.lat * rad,
		    sinDLat = Math.sin((latlng2.lat - latlng1.lat) * rad / 2),
		    sinDLon = Math.sin((latlng2.lng - latlng1.lng) * rad / 2),
		    a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon,
		    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return this.R * c;
	}
});

/*
 * @namespace Projection
 * @projection L.Projection.SphericalMercator
 *
 * Spherical Mercator projection — the most common projection for online maps,
 * used by almost all free and commercial tile providers. Assumes that Earth is
 * a sphere. Used by the `EPSG:3857` CRS.
 */

var earthRadius = 6378137;

var SphericalMercator = {

	R: earthRadius,
	MAX_LATITUDE: 85.0511287798,

	project: function (latlng) {
		var d = Math.PI / 180,
		    max = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(max, latlng.lat), -max),
		    sin = Math.sin(lat * d);

		return new Point(
			this.R * latlng.lng * d,
			this.R * Math.log((1 + sin) / (1 - sin)) / 2);
	},

	unproject: function (point) {
		var d = 180 / Math.PI;

		return new LatLng(
			(2 * Math.atan(Math.exp(point.y / this.R)) - (Math.PI / 2)) * d,
			point.x * d / this.R);
	},

	bounds: (function () {
		var d = earthRadius * Math.PI;
		return new Bounds([-d, -d], [d, d]);
	})()
};

/*
 * @class Transformation
 * @aka L.Transformation
 *
 * Represents an affine transformation: a set of coefficients `a`, `b`, `c`, `d`
 * for transforming a point of a form `(x, y)` into `(a*x + b, c*y + d)` and doing
 * the reverse. Used by Leaflet in its projections code.
 *
 * @example
 *
 * ```js
 * var transformation = L.transformation(2, 5, -1, 10),
 * 	p = L.point(1, 2),
 * 	p2 = transformation.transform(p), //  L.point(7, 8)
 * 	p3 = transformation.untransform(p2); //  L.point(1, 2)
 * ```
 */


// factory new L.Transformation(a: Number, b: Number, c: Number, d: Number)
// Creates a `Transformation` object with the given coefficients.
function Transformation(a, b, c, d) {
	if (isArray(a)) {
		// use array properties
		this._a = a[0];
		this._b = a[1];
		this._c = a[2];
		this._d = a[3];
		return;
	}
	this._a = a;
	this._b = b;
	this._c = c;
	this._d = d;
}

Transformation.prototype = {
	// @method transform(point: Point, scale?: Number): Point
	// Returns a transformed point, optionally multiplied by the given scale.
	// Only accepts actual `L.Point` instances, not arrays.
	transform: function (point, scale) { // (Point, Number) -> Point
		return this._transform(point.clone(), scale);
	},

	// destructive transform (faster)
	_transform: function (point, scale) {
		scale = scale || 1;
		point.x = scale * (this._a * point.x + this._b);
		point.y = scale * (this._c * point.y + this._d);
		return point;
	},

	// @method untransform(point: Point, scale?: Number): Point
	// Returns the reverse transformation of the given point, optionally divided
	// by the given scale. Only accepts actual `L.Point` instances, not arrays.
	untransform: function (point, scale) {
		scale = scale || 1;
		return new Point(
		        (point.x / scale - this._b) / this._a,
		        (point.y / scale - this._d) / this._c);
	}
};

// factory L.transformation(a: Number, b: Number, c: Number, d: Number)

// @factory L.transformation(a: Number, b: Number, c: Number, d: Number)
// Instantiates a Transformation object with the given coefficients.

// @alternative
// @factory L.transformation(coefficients: Array): Transformation
// Expects an coefficients array of the form
// `[a: Number, b: Number, c: Number, d: Number]`.

function toTransformation(a, b, c, d) {
	return new Transformation(a, b, c, d);
}

/*
 * @namespace CRS
 * @crs L.CRS.EPSG3857
 *
 * The most common CRS for online maps, used by almost all free and commercial
 * tile providers. Uses Spherical Mercator projection. Set in by default in
 * Map's `crs` option.
 */

var EPSG3857 = extend({}, Earth, {
	code: 'EPSG:3857',
	projection: SphericalMercator,

	transformation: (function () {
		var scale = 0.5 / (Math.PI * SphericalMercator.R);
		return toTransformation(scale, 0.5, -scale, 0.5);
	}())
});

var EPSG900913 = extend({}, EPSG3857, {
	code: 'EPSG:900913'
});

// @namespace SVG; @section
// There are several static functions which can be called without instantiating L.SVG:

// @function create(name: String): SVGElement
// Returns a instance of [SVGElement](https://developer.mozilla.org/docs/Web/API/SVGElement),
// corresponding to the class name passed. For example, using 'line' will return
// an instance of [SVGLineElement](https://developer.mozilla.org/docs/Web/API/SVGLineElement).
function svgCreate(name) {
	return document.createElementNS('http://www.w3.org/2000/svg', name);
}

// @function pointsToPath(rings: Point[], closed: Boolean): String
// Generates a SVG path string for multiple rings, with each ring turning
// into "M..L..L.." instructions
function pointsToPath(rings, closed) {
	var str = '',
	i, j, len, len2, points, p;

	for (i = 0, len = rings.length; i < len; i++) {
		points = rings[i];

		for (j = 0, len2 = points.length; j < len2; j++) {
			p = points[j];
			str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
		}

		// closes the ring for polygons; "x" is VML syntax
		str += closed ? (svg ? 'z' : 'x') : '';
	}

	// SVG complains about empty path strings
	return str || 'M0 0';
}

/*
 * @namespace Browser
 * @aka L.Browser
 *
 * A namespace with static properties for browser/feature detection used by Leaflet internally.
 *
 * @example
 *
 * ```js
 * if (L.Browser.ielt9) {
 *   alert('Upgrade your browser, dude!');
 * }
 * ```
 */

var style$1 = document.documentElement.style;

// @property ie: Boolean; `true` for all Internet Explorer versions (not Edge).
var ie = 'ActiveXObject' in window;

// @property ielt9: Boolean; `true` for Internet Explorer versions less than 9.
var ielt9 = ie && !document.addEventListener;

// @property edge: Boolean; `true` for the Edge web browser.
var edge = 'msLaunchUri' in navigator && !('documentMode' in document);

// @property webkit: Boolean;
// `true` for webkit-based browsers like Chrome and Safari (including mobile versions).
var webkit = userAgentContains('webkit');

// @property android: Boolean
// `true` for any browser running on an Android platform.
var android = userAgentContains('android');

// @property android23: Boolean; `true` for browsers running on Android 2 or Android 3.
var android23 = userAgentContains('android 2') || userAgentContains('android 3');

/* See https://stackoverflow.com/a/17961266 for details on detecting stock Android */
var webkitVer = parseInt(/WebKit\/([0-9]+)|$/.exec(navigator.userAgent)[1], 10); // also matches AppleWebKit
// @property androidStock: Boolean; `true` for the Android stock browser (i.e. not Chrome)
var androidStock = android && userAgentContains('Google') && webkitVer < 537 && !('AudioNode' in window);

// @property opera: Boolean; `true` for the Opera browser
var opera = !!window.opera;

// @property chrome: Boolean; `true` for the Chrome browser.
var chrome = userAgentContains('chrome');

// @property gecko: Boolean; `true` for gecko-based browsers like Firefox.
var gecko = userAgentContains('gecko') && !webkit && !opera && !ie;

// @property safari: Boolean; `true` for the Safari browser.
var safari = !chrome && userAgentContains('safari');

var phantom = userAgentContains('phantom');

// @property opera12: Boolean
// `true` for the Opera browser supporting CSS transforms (version 12 or later).
var opera12 = 'OTransition' in style$1;

// @property win: Boolean; `true` when the browser is running in a Windows platform
var win = navigator.platform.indexOf('Win') === 0;

// @property ie3d: Boolean; `true` for all Internet Explorer versions supporting CSS transforms.
var ie3d = ie && ('transition' in style$1);

// @property webkit3d: Boolean; `true` for webkit-based browsers supporting CSS transforms.
var webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23;

// @property gecko3d: Boolean; `true` for gecko-based browsers supporting CSS transforms.
var gecko3d = 'MozPerspective' in style$1;

// @property any3d: Boolean
// `true` for all browsers supporting CSS transforms.
var any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d) && !opera12 && !phantom;

// @property mobile: Boolean; `true` for all browsers running in a mobile device.
var mobile = typeof orientation !== 'undefined' || userAgentContains('mobile');

// @property mobileWebkit: Boolean; `true` for all webkit-based browsers in a mobile device.
var mobileWebkit = mobile && webkit;

// @property mobileWebkit3d: Boolean
// `true` for all webkit-based browsers in a mobile device supporting CSS transforms.
var mobileWebkit3d = mobile && webkit3d;

// @property msPointer: Boolean
// `true` for browsers implementing the Microsoft touch events model (notably IE10).
var msPointer = !window.PointerEvent && window.MSPointerEvent;

// @property pointer: Boolean
// `true` for all browsers supporting [pointer events](https://msdn.microsoft.com/en-us/library/dn433244%28v=vs.85%29.aspx).
var pointer = !!(window.PointerEvent || msPointer);

// @property touch: Boolean
// `true` for all browsers supporting [touch events](https://developer.mozilla.org/docs/Web/API/Touch_events).
// This does not necessarily mean that the browser is running in a computer with
// a touchscreen, it only means that the browser is capable of understanding
// touch events.
var touch = !window.L_NO_TOUCH && (pointer || 'ontouchstart' in window ||
		(window.DocumentTouch && document instanceof window.DocumentTouch));

// @property mobileOpera: Boolean; `true` for the Opera browser in a mobile device.
var mobileOpera = mobile && opera;

// @property mobileGecko: Boolean
// `true` for gecko-based browsers running in a mobile device.
var mobileGecko = mobile && gecko;

// @property retina: Boolean
// `true` for browsers on a high-resolution "retina" screen or on any screen when browser's display zoom is more than 100%.
var retina = (window.devicePixelRatio || (window.screen.deviceXDPI / window.screen.logicalXDPI)) > 1;


// @property canvas: Boolean
// `true` when the browser supports [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
var canvas = (function () {
	return !!document.createElement('canvas').getContext;
}());

// @property svg: Boolean
// `true` when the browser supports [SVG](https://developer.mozilla.org/docs/Web/SVG).
var svg = !!(document.createElementNS && svgCreate('svg').createSVGRect);

// @property vml: Boolean
// `true` if the browser supports [VML](https://en.wikipedia.org/wiki/Vector_Markup_Language).
var vml = !svg && (function () {
	try {
		var div = document.createElement('div');
		div.innerHTML = '<v:shape adj="1"/>';

		var shape = div.firstChild;
		shape.style.behavior = 'url(#default#VML)';

		return shape && (typeof shape.adj === 'object');

	} catch (e) {
		return false;
	}
}());


function userAgentContains(str) {
	return navigator.userAgent.toLowerCase().indexOf(str) >= 0;
}


var Browser = (Object.freeze || Object)({
	ie: ie,
	ielt9: ielt9,
	edge: edge,
	webkit: webkit,
	android: android,
	android23: android23,
	androidStock: androidStock,
	opera: opera,
	chrome: chrome,
	gecko: gecko,
	safari: safari,
	phantom: phantom,
	opera12: opera12,
	win: win,
	ie3d: ie3d,
	webkit3d: webkit3d,
	gecko3d: gecko3d,
	any3d: any3d,
	mobile: mobile,
	mobileWebkit: mobileWebkit,
	mobileWebkit3d: mobileWebkit3d,
	msPointer: msPointer,
	pointer: pointer,
	touch: touch,
	mobileOpera: mobileOpera,
	mobileGecko: mobileGecko,
	retina: retina,
	canvas: canvas,
	svg: svg,
	vml: vml
});

/*
 * Extends L.DomEvent to provide touch support for Internet Explorer and Windows-based devices.
 */


var POINTER_DOWN =   msPointer ? 'MSPointerDown'   : 'pointerdown';
var POINTER_MOVE =   msPointer ? 'MSPointerMove'   : 'pointermove';
var POINTER_UP =     msPointer ? 'MSPointerUp'     : 'pointerup';
var POINTER_CANCEL = msPointer ? 'MSPointerCancel' : 'pointercancel';
var TAG_WHITE_LIST = ['INPUT', 'SELECT', 'OPTION'];

var _pointers = {};
var _pointerDocListener = false;

// DomEvent.DoubleTap needs to know about this
var _pointersCount = 0;

// Provides a touch events wrapper for (ms)pointer events.
// ref http://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890

function addPointerListener(obj, type, handler, id) {
	if (type === 'touchstart') {
		_addPointerStart(obj, handler, id);

	} else if (type === 'touchmove') {
		_addPointerMove(obj, handler, id);

	} else if (type === 'touchend') {
		_addPointerEnd(obj, handler, id);
	}

	return this;
}

function removePointerListener(obj, type, id) {
	var handler = obj['_leaflet_' + type + id];

	if (type === 'touchstart') {
		obj.removeEventListener(POINTER_DOWN, handler, false);

	} else if (type === 'touchmove') {
		obj.removeEventListener(POINTER_MOVE, handler, false);

	} else if (type === 'touchend') {
		obj.removeEventListener(POINTER_UP, handler, false);
		obj.removeEventListener(POINTER_CANCEL, handler, false);
	}

	return this;
}

function _addPointerStart(obj, handler, id) {
	var onDown = bind(function (e) {
		if (e.pointerType !== 'mouse' && e.MSPOINTER_TYPE_MOUSE && e.pointerType !== e.MSPOINTER_TYPE_MOUSE) {
			// In IE11, some touch events needs to fire for form controls, or
			// the controls will stop working. We keep a whitelist of tag names that
			// need these events. For other target tags, we prevent default on the event.
			if (TAG_WHITE_LIST.indexOf(e.target.tagName) < 0) {
				preventDefault(e);
			} else {
				return;
			}
		}

		_handlePointer(e, handler);
	});

	obj['_leaflet_touchstart' + id] = onDown;
	obj.addEventListener(POINTER_DOWN, onDown, false);

	// need to keep track of what pointers and how many are active to provide e.touches emulation
	if (!_pointerDocListener) {
		// we listen documentElement as any drags that end by moving the touch off the screen get fired there
		document.documentElement.addEventListener(POINTER_DOWN, _globalPointerDown, true);
		document.documentElement.addEventListener(POINTER_MOVE, _globalPointerMove, true);
		document.documentElement.addEventListener(POINTER_UP, _globalPointerUp, true);
		document.documentElement.addEventListener(POINTER_CANCEL, _globalPointerUp, true);

		_pointerDocListener = true;
	}
}

function _globalPointerDown(e) {
	_pointers[e.pointerId] = e;
	_pointersCount++;
}

function _globalPointerMove(e) {
	if (_pointers[e.pointerId]) {
		_pointers[e.pointerId] = e;
	}
}

function _globalPointerUp(e) {
	delete _pointers[e.pointerId];
	_pointersCount--;
}

function _handlePointer(e, handler) {
	e.touches = [];
	for (var i in _pointers) {
		e.touches.push(_pointers[i]);
	}
	e.changedTouches = [e];

	handler(e);
}

function _addPointerMove(obj, handler, id) {
	var onMove = function (e) {
		// don't fire touch moves when mouse isn't down
		if ((e.pointerType === e.MSPOINTER_TYPE_MOUSE || e.pointerType === 'mouse') && e.buttons === 0) { return; }

		_handlePointer(e, handler);
	};

	obj['_leaflet_touchmove' + id] = onMove;
	obj.addEventListener(POINTER_MOVE, onMove, false);
}

function _addPointerEnd(obj, handler, id) {
	var onUp = function (e) {
		_handlePointer(e, handler);
	};

	obj['_leaflet_touchend' + id] = onUp;
	obj.addEventListener(POINTER_UP, onUp, false);
	obj.addEventListener(POINTER_CANCEL, onUp, false);
}

/*
 * Extends the event handling code with double tap support for mobile browsers.
 */

var _touchstart = msPointer ? 'MSPointerDown' : pointer ? 'pointerdown' : 'touchstart';
var _touchend = msPointer ? 'MSPointerUp' : pointer ? 'pointerup' : 'touchend';
var _pre = '_leaflet_';

// inspired by Zepto touch code by Thomas Fuchs
function addDoubleTapListener(obj, handler, id) {
	var last, touch$$1,
	    doubleTap = false,
	    delay = 250;

	function onTouchStart(e) {
		var count;

		if (pointer) {
			if ((!edge) || e.pointerType === 'mouse') { return; }
			count = _pointersCount;
		} else {
			count = e.touches.length;
		}

		if (count > 1) { return; }

		var now = Date.now(),
		    delta = now - (last || now);

		touch$$1 = e.touches ? e.touches[0] : e;
		doubleTap = (delta > 0 && delta <= delay);
		last = now;
	}

	function onTouchEnd(e) {
		if (doubleTap && !touch$$1.cancelBubble) {
			if (pointer) {
				if ((!edge) || e.pointerType === 'mouse') { return; }
				// work around .type being readonly with MSPointer* events
				var newTouch = {},
				    prop, i;

				for (i in touch$$1) {
					prop = touch$$1[i];
					newTouch[i] = prop && prop.bind ? prop.bind(touch$$1) : prop;
				}
				touch$$1 = newTouch;
			}
			touch$$1.type = 'dblclick';
			touch$$1.button = 0;
			handler(touch$$1);
			last = null;
		}
	}

	obj[_pre + _touchstart + id] = onTouchStart;
	obj[_pre + _touchend + id] = onTouchEnd;
	obj[_pre + 'dblclick' + id] = handler;

	obj.addEventListener(_touchstart, onTouchStart, false);
	obj.addEventListener(_touchend, onTouchEnd, false);

	// On some platforms (notably, chrome<55 on win10 + touchscreen + mouse),
	// the browser doesn't fire touchend/pointerup events but does fire
	// native dblclicks. See #4127.
	// Edge 14 also fires native dblclicks, but only for pointerType mouse, see #5180.
	obj.addEventListener('dblclick', handler, false);

	return this;
}

function removeDoubleTapListener(obj, id) {
	var touchstart = obj[_pre + _touchstart + id],
	    touchend = obj[_pre + _touchend + id],
	    dblclick = obj[_pre + 'dblclick' + id];

	obj.removeEventListener(_touchstart, touchstart, false);
	obj.removeEventListener(_touchend, touchend, false);
	if (!edge) {
		obj.removeEventListener('dblclick', dblclick, false);
	}

	return this;
}

/*
 * @namespace DomUtil
 *
 * Utility functions to work with the [DOM](https://developer.mozilla.org/docs/Web/API/Document_Object_Model)
 * tree, used by Leaflet internally.
 *
 * Most functions expecting or returning a `HTMLElement` also work for
 * SVG elements. The only difference is that classes refer to CSS classes
 * in HTML and SVG classes in SVG.
 */


// @property TRANSFORM: String
// Vendor-prefixed transform style name (e.g. `'webkitTransform'` for WebKit).
var TRANSFORM = testProp(
	['transform', 'webkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

// webkitTransition comes first because some browser versions that drop vendor prefix don't do
// the same for the transitionend event, in particular the Android 4.1 stock browser

// @property TRANSITION: String
// Vendor-prefixed transition style name.
var TRANSITION = testProp(
	['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

// @property TRANSITION_END: String
// Vendor-prefixed transitionend event name.
var TRANSITION_END =
	TRANSITION === 'webkitTransition' || TRANSITION === 'OTransition' ? TRANSITION + 'End' : 'transitionend';


// @function get(id: String|HTMLElement): HTMLElement
// Returns an element given its DOM id, or returns the element itself
// if it was passed directly.
function get(id) {
	return typeof id === 'string' ? document.getElementById(id) : id;
}

// @function getStyle(el: HTMLElement, styleAttrib: String): String
// Returns the value for a certain style attribute on an element,
// including computed values or values set through CSS.
function getStyle(el, style) {
	var value = el.style[style] || (el.currentStyle && el.currentStyle[style]);

	if ((!value || value === 'auto') && document.defaultView) {
		var css = document.defaultView.getComputedStyle(el, null);
		value = css ? css[style] : null;
	}
	return value === 'auto' ? null : value;
}

// @function create(tagName: String, className?: String, container?: HTMLElement): HTMLElement
// Creates an HTML element with `tagName`, sets its class to `className`, and optionally appends it to `container` element.
function create$1(tagName, className, container) {
	var el = document.createElement(tagName);
	el.className = className || '';

	if (container) {
		container.appendChild(el);
	}
	return el;
}

// @function remove(el: HTMLElement)
// Removes `el` from its parent element
function remove(el) {
	var parent = el.parentNode;
	if (parent) {
		parent.removeChild(el);
	}
}

// @function empty(el: HTMLElement)
// Removes all of `el`'s children elements from `el`
function empty(el) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

// @function toFront(el: HTMLElement)
// Makes `el` the last child of its parent, so it renders in front of the other children.
function toFront(el) {
	var parent = el.parentNode;
	if (parent && parent.lastChild !== el) {
		parent.appendChild(el);
	}
}

// @function toBack(el: HTMLElement)
// Makes `el` the first child of its parent, so it renders behind the other children.
function toBack(el) {
	var parent = el.parentNode;
	if (parent && parent.firstChild !== el) {
		parent.insertBefore(el, parent.firstChild);
	}
}

// @function hasClass(el: HTMLElement, name: String): Boolean
// Returns `true` if the element's class attribute contains `name`.
function hasClass(el, name) {
	if (el.classList !== undefined) {
		return el.classList.contains(name);
	}
	var className = getClass(el);
	return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
}

// @function addClass(el: HTMLElement, name: String)
// Adds `name` to the element's class attribute.
function addClass(el, name) {
	if (el.classList !== undefined) {
		var classes = splitWords(name);
		for (var i = 0, len = classes.length; i < len; i++) {
			el.classList.add(classes[i]);
		}
	} else if (!hasClass(el, name)) {
		var className = getClass(el);
		setClass(el, (className ? className + ' ' : '') + name);
	}
}

// @function removeClass(el: HTMLElement, name: String)
// Removes `name` from the element's class attribute.
function removeClass(el, name) {
	if (el.classList !== undefined) {
		el.classList.remove(name);
	} else {
		setClass(el, trim((' ' + getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
	}
}

// @function setClass(el: HTMLElement, name: String)
// Sets the element's class.
function setClass(el, name) {
	if (el.className.baseVal === undefined) {
		el.className = name;
	} else {
		// in case of SVG element
		el.className.baseVal = name;
	}
}

// @function getClass(el: HTMLElement): String
// Returns the element's class.
function getClass(el) {
	// Check if the element is an SVGElementInstance and use the correspondingElement instead
	// (Required for linked SVG elements in IE11.)
	if (el.correspondingElement) {
		el = el.correspondingElement;
	}
	return el.className.baseVal === undefined ? el.className : el.className.baseVal;
}

// @function setOpacity(el: HTMLElement, opacity: Number)
// Set the opacity of an element (including old IE support).
// `opacity` must be a number from `0` to `1`.
function setOpacity(el, value) {
	if ('opacity' in el.style) {
		el.style.opacity = value;
	} else if ('filter' in el.style) {
		_setOpacityIE(el, value);
	}
}

function _setOpacityIE(el, value) {
	var filter = false,
	    filterName = 'DXImageTransform.Microsoft.Alpha';

	// filters collection throws an error if we try to retrieve a filter that doesn't exist
	try {
		filter = el.filters.item(filterName);
	} catch (e) {
		// don't set opacity to 1 if we haven't already set an opacity,
		// it isn't needed and breaks transparent pngs.
		if (value === 1) { return; }
	}

	value = Math.round(value * 100);

	if (filter) {
		filter.Enabled = (value !== 100);
		filter.Opacity = value;
	} else {
		el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
	}
}

// @function testProp(props: String[]): String|false
// Goes through the array of style names and returns the first name
// that is a valid style name for an element. If no such name is found,
// it returns false. Useful for vendor-prefixed styles like `transform`.
function testProp(props) {
	var style = document.documentElement.style;

	for (var i = 0; i < props.length; i++) {
		if (props[i] in style) {
			return props[i];
		}
	}
	return false;
}

// @function setTransform(el: HTMLElement, offset: Point, scale?: Number)
// Resets the 3D CSS transform of `el` so it is translated by `offset` pixels
// and optionally scaled by `scale`. Does not have an effect if the
// browser doesn't support 3D CSS transforms.
function setTransform(el, offset, scale) {
	var pos = offset || new Point(0, 0);

	el.style[TRANSFORM] =
		(ie3d ?
			'translate(' + pos.x + 'px,' + pos.y + 'px)' :
			'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)') +
		(scale ? ' scale(' + scale + ')' : '');
}

// @function setPosition(el: HTMLElement, position: Point)
// Sets the position of `el` to coordinates specified by `position`,
// using CSS translate or top/left positioning depending on the browser
// (used by Leaflet internally to position its layers).
function setPosition(el, point) {

	/*eslint-disable */
	el._leaflet_pos = point;
	/* eslint-enable */

	if (any3d) {
		setTransform(el, point);
	} else {
		el.style.left = point.x + 'px';
		el.style.top = point.y + 'px';
	}
}

// @function getPosition(el: HTMLElement): Point
// Returns the coordinates of an element previously positioned with setPosition.
function getPosition(el) {
	// this method is only used for elements previously positioned using setPosition,
	// so it's safe to cache the position for performance

	return el._leaflet_pos || new Point(0, 0);
}

// @function disableTextSelection()
// Prevents the user from generating `selectstart` DOM events, usually generated
// when the user drags the mouse through a page with text. Used internally
// by Leaflet to override the behaviour of any click-and-drag interaction on
// the map. Affects drag interactions on the whole document.

// @function enableTextSelection()
// Cancels the effects of a previous [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection).
var disableTextSelection;
var enableTextSelection;
var _userSelect;
if ('onselectstart' in document) {
	disableTextSelection = function () {
		on(window, 'selectstart', preventDefault);
	};
	enableTextSelection = function () {
		off(window, 'selectstart', preventDefault);
	};
} else {
	var userSelectProperty = testProp(
		['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

	disableTextSelection = function () {
		if (userSelectProperty) {
			var style = document.documentElement.style;
			_userSelect = style[userSelectProperty];
			style[userSelectProperty] = 'none';
		}
	};
	enableTextSelection = function () {
		if (userSelectProperty) {
			document.documentElement.style[userSelectProperty] = _userSelect;
			_userSelect = undefined;
		}
	};
}

// @function disableImageDrag()
// As [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection), but
// for `dragstart` DOM events, usually generated when the user drags an image.
function disableImageDrag() {
	on(window, 'dragstart', preventDefault);
}

// @function enableImageDrag()
// Cancels the effects of a previous [`L.DomUtil.disableImageDrag`](#domutil-disabletextselection).
function enableImageDrag() {
	off(window, 'dragstart', preventDefault);
}

var _outlineElement;
var _outlineStyle;
// @function preventOutline(el: HTMLElement)
// Makes the [outline](https://developer.mozilla.org/docs/Web/CSS/outline)
// of the element `el` invisible. Used internally by Leaflet to prevent
// focusable elements from displaying an outline when the user performs a
// drag interaction on them.
function preventOutline(element) {
	while (element.tabIndex === -1) {
		element = element.parentNode;
	}
	if (!element.style) { return; }
	restoreOutline();
	_outlineElement = element;
	_outlineStyle = element.style.outline;
	element.style.outline = 'none';
	on(window, 'keydown', restoreOutline);
}

// @function restoreOutline()
// Cancels the effects of a previous [`L.DomUtil.preventOutline`]().
function restoreOutline() {
	if (!_outlineElement) { return; }
	_outlineElement.style.outline = _outlineStyle;
	_outlineElement = undefined;
	_outlineStyle = undefined;
	off(window, 'keydown', restoreOutline);
}

// @function getSizedParentNode(el: HTMLElement): HTMLElement
// Finds the closest parent node which size (width and height) is not null.
function getSizedParentNode(element) {
	do {
		element = element.parentNode;
	} while ((!element.offsetWidth || !element.offsetHeight) && element !== document.body);
	return element;
}

// @function getScale(el: HTMLElement): Object
// Computes the CSS scale currently applied on the element.
// Returns an object with `x` and `y` members as horizontal and vertical scales respectively,
// and `boundingClientRect` as the result of [`getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).
function getScale(element) {
	var rect = element.getBoundingClientRect(); // Read-only in old browsers.

	return {
		x: rect.width / element.offsetWidth || 1,
		y: rect.height / element.offsetHeight || 1,
		boundingClientRect: rect
	};
}


var DomUtil = (Object.freeze || Object)({
	TRANSFORM: TRANSFORM,
	TRANSITION: TRANSITION,
	TRANSITION_END: TRANSITION_END,
	get: get,
	getStyle: getStyle,
	create: create$1,
	remove: remove,
	empty: empty,
	toFront: toFront,
	toBack: toBack,
	hasClass: hasClass,
	addClass: addClass,
	removeClass: removeClass,
	setClass: setClass,
	getClass: getClass,
	setOpacity: setOpacity,
	testProp: testProp,
	setTransform: setTransform,
	setPosition: setPosition,
	getPosition: getPosition,
	disableTextSelection: disableTextSelection,
	enableTextSelection: enableTextSelection,
	disableImageDrag: disableImageDrag,
	enableImageDrag: enableImageDrag,
	preventOutline: preventOutline,
	restoreOutline: restoreOutline,
	getSizedParentNode: getSizedParentNode,
	getScale: getScale
});

/*
 * @namespace DomEvent
 * Utility functions to work with the [DOM events](https://developer.mozilla.org/docs/Web/API/Event), used by Leaflet internally.
 */

// Inspired by John Resig, Dean Edwards and YUI addEvent implementations.

// @function on(el: HTMLElement, types: String, fn: Function, context?: Object): this
// Adds a listener function (`fn`) to a particular DOM event type of the
// element `el`. You can optionally specify the context of the listener
// (object the `this` keyword will point to). You can also pass several
// space-separated types (e.g. `'click dblclick'`).

// @alternative
// @function on(el: HTMLElement, eventMap: Object, context?: Object): this
// Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
function on(obj, types, fn, context) {

	if (typeof types === 'object') {
		for (var type in types) {
			addOne(obj, type, types[type], fn);
		}
	} else {
		types = splitWords(types);

		for (var i = 0, len = types.length; i < len; i++) {
			addOne(obj, types[i], fn, context);
		}
	}

	return this;
}

var eventsKey = '_leaflet_events';

// @function off(el: HTMLElement, types: String, fn: Function, context?: Object): this
// Removes a previously added listener function.
// Note that if you passed a custom context to on, you must pass the same
// context to `off` in order to remove the listener.

// @alternative
// @function off(el: HTMLElement, eventMap: Object, context?: Object): this
// Removes a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
function off(obj, types, fn, context) {

	if (typeof types === 'object') {
		for (var type in types) {
			removeOne(obj, type, types[type], fn);
		}
	} else if (types) {
		types = splitWords(types);

		for (var i = 0, len = types.length; i < len; i++) {
			removeOne(obj, types[i], fn, context);
		}
	} else {
		for (var j in obj[eventsKey]) {
			removeOne(obj, j, obj[eventsKey][j]);
		}
		delete obj[eventsKey];
	}

	return this;
}

function addOne(obj, type, fn, context) {
	var id = type + stamp(fn) + (context ? '_' + stamp(context) : '');

	if (obj[eventsKey] && obj[eventsKey][id]) { return this; }

	var handler = function (e) {
		return fn.call(context || obj, e || window.event);
	};

	var originalHandler = handler;

	if (pointer && type.indexOf('touch') === 0) {
		// Needs DomEvent.Pointer.js
		addPointerListener(obj, type, handler, id);

	} else if (touch && (type === 'dblclick') && addDoubleTapListener &&
	           !(pointer && chrome)) {
		// Chrome >55 does not need the synthetic dblclicks from addDoubleTapListener
		// See #5180
		addDoubleTapListener(obj, handler, id);

	} else if ('addEventListener' in obj) {

		if (type === 'mousewheel') {
			obj.addEventListener('onwheel' in obj ? 'wheel' : 'mousewheel', handler, false);

		} else if ((type === 'mouseenter') || (type === 'mouseleave')) {
			handler = function (e) {
				e = e || window.event;
				if (isExternalTarget(obj, e)) {
					originalHandler(e);
				}
			};
			obj.addEventListener(type === 'mouseenter' ? 'mouseover' : 'mouseout', handler, false);

		} else {
			if (type === 'click' && android) {
				handler = function (e) {
					filterClick(e, originalHandler);
				};
			}
			obj.addEventListener(type, handler, false);
		}

	} else if ('attachEvent' in obj) {
		obj.attachEvent('on' + type, handler);
	}

	obj[eventsKey] = obj[eventsKey] || {};
	obj[eventsKey][id] = handler;
}

function removeOne(obj, type, fn, context) {

	var id = type + stamp(fn) + (context ? '_' + stamp(context) : ''),
	    handler = obj[eventsKey] && obj[eventsKey][id];

	if (!handler) { return this; }

	if (pointer && type.indexOf('touch') === 0) {
		removePointerListener(obj, type, id);

	} else if (touch && (type === 'dblclick') && removeDoubleTapListener &&
	           !(pointer && chrome)) {
		removeDoubleTapListener(obj, id);

	} else if ('removeEventListener' in obj) {

		if (type === 'mousewheel') {
			obj.removeEventListener('onwheel' in obj ? 'wheel' : 'mousewheel', handler, false);

		} else {
			obj.removeEventListener(
				type === 'mouseenter' ? 'mouseover' :
				type === 'mouseleave' ? 'mouseout' : type, handler, false);
		}

	} else if ('detachEvent' in obj) {
		obj.detachEvent('on' + type, handler);
	}

	obj[eventsKey][id] = null;
}

// @function stopPropagation(ev: DOMEvent): this
// Stop the given event from propagation to parent elements. Used inside the listener functions:
// ```js
// L.DomEvent.on(div, 'click', function (ev) {
// 	L.DomEvent.stopPropagation(ev);
// });
// ```
function stopPropagation(e) {

	if (e.stopPropagation) {
		e.stopPropagation();
	} else if (e.originalEvent) {  // In case of Leaflet event.
		e.originalEvent._stopped = true;
	} else {
		e.cancelBubble = true;
	}
	skipped(e);

	return this;
}

// @function disableScrollPropagation(el: HTMLElement): this
// Adds `stopPropagation` to the element's `'mousewheel'` events (plus browser variants).
function disableScrollPropagation(el) {
	addOne(el, 'mousewheel', stopPropagation);
	return this;
}

// @function disableClickPropagation(el: HTMLElement): this
// Adds `stopPropagation` to the element's `'click'`, `'doubleclick'`,
// `'mousedown'` and `'touchstart'` events (plus browser variants).
function disableClickPropagation(el) {
	on(el, 'mousedown touchstart dblclick', stopPropagation);
	addOne(el, 'click', fakeStop);
	return this;
}

// @function preventDefault(ev: DOMEvent): this
// Prevents the default action of the DOM Event `ev` from happening (such as
// following a link in the href of the a element, or doing a POST request
// with page reload when a `<form>` is submitted).
// Use it inside listener functions.
function preventDefault(e) {
	if (e.preventDefault) {
		e.preventDefault();
	} else {
		e.returnValue = false;
	}
	return this;
}

// @function stop(ev: DOMEvent): this
// Does `stopPropagation` and `preventDefault` at the same time.
function stop(e) {
	preventDefault(e);
	stopPropagation(e);
	return this;
}

// @function getMousePosition(ev: DOMEvent, container?: HTMLElement): Point
// Gets normalized mouse position from a DOM event relative to the
// `container` (border excluded) or to the whole page if not specified.
function getMousePosition(e, container) {
	if (!container) {
		return new Point(e.clientX, e.clientY);
	}

	var scale = getScale(container),
	    offset = scale.boundingClientRect; // left and top  values are in page scale (like the event clientX/Y)

	return new Point(
		// offset.left/top values are in page scale (like clientX/Y),
		// whereas clientLeft/Top (border width) values are the original values (before CSS scale applies).
		(e.clientX - offset.left) / scale.x - container.clientLeft,
		(e.clientY - offset.top) / scale.y - container.clientTop
	);
}

// Chrome on Win scrolls double the pixels as in other platforms (see #4538),
// and Firefox scrolls device pixels, not CSS pixels
var wheelPxFactor =
	(win && chrome) ? 2 * window.devicePixelRatio :
	gecko ? window.devicePixelRatio : 1;

// @function getWheelDelta(ev: DOMEvent): Number
// Gets normalized wheel delta from a mousewheel DOM event, in vertical
// pixels scrolled (negative if scrolling down).
// Events from pointing devices without precise scrolling are mapped to
// a best guess of 60 pixels.
function getWheelDelta(e) {
	return (edge) ? e.wheelDeltaY / 2 : // Don't trust window-geometry-based delta
	       (e.deltaY && e.deltaMode === 0) ? -e.deltaY / wheelPxFactor : // Pixels
	       (e.deltaY && e.deltaMode === 1) ? -e.deltaY * 20 : // Lines
	       (e.deltaY && e.deltaMode === 2) ? -e.deltaY * 60 : // Pages
	       (e.deltaX || e.deltaZ) ? 0 :	// Skip horizontal/depth wheel events
	       e.wheelDelta ? (e.wheelDeltaY || e.wheelDelta) / 2 : // Legacy IE pixels
	       (e.detail && Math.abs(e.detail) < 32765) ? -e.detail * 20 : // Legacy Moz lines
	       e.detail ? e.detail / -32765 * 60 : // Legacy Moz pages
	       0;
}

var skipEvents = {};

function fakeStop(e) {
	// fakes stopPropagation by setting a special event flag, checked/reset with skipped(e)
	skipEvents[e.type] = true;
}

function skipped(e) {
	var events = skipEvents[e.type];
	// reset when checking, as it's only used in map container and propagates outside of the map
	skipEvents[e.type] = false;
	return events;
}

// check if element really left/entered the event target (for mouseenter/mouseleave)
function isExternalTarget(el, e) {

	var related = e.relatedTarget;

	if (!related) { return true; }

	try {
		while (related && (related !== el)) {
			related = related.parentNode;
		}
	} catch (err) {
		return false;
	}
	return (related !== el);
}

var lastClick;

// this is a horrible workaround for a bug in Android where a single touch triggers two click events
function filterClick(e, handler) {
	var timeStamp = (e.timeStamp || (e.originalEvent && e.originalEvent.timeStamp)),
	    elapsed = lastClick && (timeStamp - lastClick);

	// are they closer together than 500ms yet more than 100ms?
	// Android typically triggers them ~300ms apart while multiple listeners
	// on the same event should be triggered far faster;
	// or check if click is simulated on the element, and if it is, reject any non-simulated events

	if ((elapsed && elapsed > 100 && elapsed < 500) || (e.target._simulatedClick && !e._simulated)) {
		stop(e);
		return;
	}
	lastClick = timeStamp;

	handler(e);
}




var DomEvent = (Object.freeze || Object)({
	on: on,
	off: off,
	stopPropagation: stopPropagation,
	disableScrollPropagation: disableScrollPropagation,
	disableClickPropagation: disableClickPropagation,
	preventDefault: preventDefault,
	stop: stop,
	getMousePosition: getMousePosition,
	getWheelDelta: getWheelDelta,
	fakeStop: fakeStop,
	skipped: skipped,
	isExternalTarget: isExternalTarget,
	addListener: on,
	removeListener: off
});

/*
 * @class PosAnimation
 * @aka L.PosAnimation
 * @inherits Evented
 * Used internally for panning animations, utilizing CSS3 Transitions for modern browsers and a timer fallback for IE6-9.
 *
 * @example
 * ```js
 * var fx = new L.PosAnimation();
 * fx.run(el, [300, 500], 0.5);
 * ```
 *
 * @constructor L.PosAnimation()
 * Creates a `PosAnimation` object.
 *
 */

var PosAnimation = Evented.extend({

	// @method run(el: HTMLElement, newPos: Point, duration?: Number, easeLinearity?: Number)
	// Run an animation of a given element to a new position, optionally setting
	// duration in seconds (`0.25` by default) and easing linearity factor (3rd
	// argument of the [cubic bezier curve](http://cubic-bezier.com/#0,0,.5,1),
	// `0.5` by default).
	run: function (el, newPos, duration, easeLinearity) {
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._duration = duration || 0.25;
		this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);

		this._startPos = getPosition(el);
		this._offset = newPos.subtract(this._startPos);
		this._startTime = +new Date();

		// @event start: Event
		// Fired when the animation starts
		this.fire('start');

		this._animate();
	},

	// @method stop()
	// Stops the animation (if currently running).
	stop: function () {
		if (!this._inProgress) { return; }

		this._step(true);
		this._complete();
	},

	_animate: function () {
		// animation loop
		this._animId = requestAnimFrame(this._animate, this);
		this._step();
	},

	_step: function (round) {
		var elapsed = (+new Date()) - this._startTime,
		    duration = this._duration * 1000;

		if (elapsed < duration) {
			this._runFrame(this._easeOut(elapsed / duration), round);
		} else {
			this._runFrame(1);
			this._complete();
		}
	},

	_runFrame: function (progress, round) {
		var pos = this._startPos.add(this._offset.multiplyBy(progress));
		if (round) {
			pos._round();
		}
		setPosition(this._el, pos);

		// @event step: Event
		// Fired continuously during the animation.
		this.fire('step');
	},

	_complete: function () {
		cancelAnimFrame(this._animId);

		this._inProgress = false;
		// @event end: Event
		// Fired when the animation ends.
		this.fire('end');
	},

	_easeOut: function (t) {
		return 1 - Math.pow(1 - t, this._easeOutPower);
	}
});

/*
 * @class Map
 * @aka L.Map
 * @inherits Evented
 *
 * The central class of the API — it is used to create a map on a page and manipulate it.
 *
 * @example
 *
 * ```js
 * // initialize the map on the "map" div with a given center and zoom
 * var map = L.map('map', {
 * 	center: [51.505, -0.09],
 * 	zoom: 13
 * });
 * ```
 *
 */

var Map = Evented.extend({

	options: {
		// @section Map State Options
		// @option crs: CRS = L.CRS.EPSG3857
		// The [Coordinate Reference System](#crs) to use. Don't change this if you're not
		// sure what it means.
		crs: EPSG3857,

		// @option center: LatLng = undefined
		// Initial geographic center of the map
		center: undefined,

		// @option zoom: Number = undefined
		// Initial map zoom level
		zoom: undefined,

		// @option minZoom: Number = *
		// Minimum zoom level of the map.
		// If not specified and at least one `GridLayer` or `TileLayer` is in the map,
		// the lowest of their `minZoom` options will be used instead.
		minZoom: undefined,

		// @option maxZoom: Number = *
		// Maximum zoom level of the map.
		// If not specified and at least one `GridLayer` or `TileLayer` is in the map,
		// the highest of their `maxZoom` options will be used instead.
		maxZoom: undefined,

		// @option layers: Layer[] = []
		// Array of layers that will be added to the map initially
		layers: [],

		// @option maxBounds: LatLngBounds = null
		// When this option is set, the map restricts the view to the given
		// geographical bounds, bouncing the user back if the user tries to pan
		// outside the view. To set the restriction dynamically, use
		// [`setMaxBounds`](#map-setmaxbounds) method.
		maxBounds: undefined,

		// @option renderer: Renderer = *
		// The default method for drawing vector layers on the map. `L.SVG`
		// or `L.Canvas` by default depending on browser support.
		renderer: undefined,


		// @section Animation Options
		// @option zoomAnimation: Boolean = true
		// Whether the map zoom animation is enabled. By default it's enabled
		// in all browsers that support CSS3 Transitions except Android.
		zoomAnimation: true,

		// @option zoomAnimationThreshold: Number = 4
		// Won't animate zoom if the zoom difference exceeds this value.
		zoomAnimationThreshold: 4,

		// @option fadeAnimation: Boolean = true
		// Whether the tile fade animation is enabled. By default it's enabled
		// in all browsers that support CSS3 Transitions except Android.
		fadeAnimation: true,

		// @option markerZoomAnimation: Boolean = true
		// Whether markers animate their zoom with the zoom animation, if disabled
		// they will disappear for the length of the animation. By default it's
		// enabled in all browsers that support CSS3 Transitions except Android.
		markerZoomAnimation: true,

		// @option transform3DLimit: Number = 2^23
		// Defines the maximum size of a CSS translation transform. The default
		// value should not be changed unless a web browser positions layers in
		// the wrong place after doing a large `panBy`.
		transform3DLimit: 8388608, // Precision limit of a 32-bit float

		// @section Interaction Options
		// @option zoomSnap: Number = 1
		// Forces the map's zoom level to always be a multiple of this, particularly
		// right after a [`fitBounds()`](#map-fitbounds) or a pinch-zoom.
		// By default, the zoom level snaps to the nearest integer; lower values
		// (e.g. `0.5` or `0.1`) allow for greater granularity. A value of `0`
		// means the zoom level will not be snapped after `fitBounds` or a pinch-zoom.
		zoomSnap: 1,

		// @option zoomDelta: Number = 1
		// Controls how much the map's zoom level will change after a
		// [`zoomIn()`](#map-zoomin), [`zoomOut()`](#map-zoomout), pressing `+`
		// or `-` on the keyboard, or using the [zoom controls](#control-zoom).
		// Values smaller than `1` (e.g. `0.5`) allow for greater granularity.
		zoomDelta: 1,

		// @option trackResize: Boolean = true
		// Whether the map automatically handles browser window resize to update itself.
		trackResize: true
	},

	initialize: function (id, options) { // (HTMLElement or String, Object)
		options = setOptions(this, options);

		// Make sure to assign internal flags at the beginning,
		// to avoid inconsistent state in some edge cases.
		this._handlers = [];
		this._layers = {};
		this._zoomBoundLayers = {};
		this._sizeChanged = true;

		this._initContainer(id);
		this._initLayout();

		// hack for https://github.com/Leaflet/Leaflet/issues/1980
		this._onResize = bind(this._onResize, this);

		this._initEvents();

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.zoom !== undefined) {
			this._zoom = this._limitZoom(options.zoom);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(toLatLng(options.center), options.zoom, {reset: true});
		}

		this.callInitHooks();

		// don't animate on browsers without hardware-accelerated transitions or old Android/Opera
		this._zoomAnimated = TRANSITION && any3d && !mobileOpera &&
				this.options.zoomAnimation;

		// zoom transitions run with the same duration for all layers, so if one of transitionend events
		// happens after starting zoom animation (propagating to the map pane), we know that it ended globally
		if (this._zoomAnimated) {
			this._createAnimProxy();
			on(this._proxy, TRANSITION_END, this._catchTransitionEnd, this);
		}

		this._addLayers(this.options.layers);
	},


	// @section Methods for modifying map state

	// @method setView(center: LatLng, zoom: Number, options?: Zoom/pan options): this
	// Sets the view of the map (geographical center and zoom) with the given
	// animation options.
	setView: function (center, zoom, options) {

		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(toLatLng(center), zoom, this.options.maxBounds);
		options = options || {};

		this._stop();

		if (this._loaded && !options.reset && options !== true) {

			if (options.animate !== undefined) {
				options.zoom = extend({animate: options.animate}, options.zoom);
				options.pan = extend({animate: options.animate, duration: options.duration}, options.pan);
			}

			// try animating pan or zoom
			var moved = (this._zoom !== zoom) ?
				this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
				this._tryAnimatedPan(center, options.pan);

			if (moved) {
				// prevent resize handler call, the view will refresh after animation anyway
				clearTimeout(this._sizeTimer);
				return this;
			}
		}

		// animation didn't start, just reset the map view
		this._resetView(center, zoom);

		return this;
	},

	// @method setZoom(zoom: Number, options?: Zoom/pan options): this
	// Sets the zoom of the map.
	setZoom: function (zoom, options) {
		if (!this._loaded) {
			this._zoom = zoom;
			return this;
		}
		return this.setView(this.getCenter(), zoom, {zoom: options});
	},

	// @method zoomIn(delta?: Number, options?: Zoom options): this
	// Increases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
	zoomIn: function (delta, options) {
		delta = delta || (any3d ? this.options.zoomDelta : 1);
		return this.setZoom(this._zoom + delta, options);
	},

	// @method zoomOut(delta?: Number, options?: Zoom options): this
	// Decreases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
	zoomOut: function (delta, options) {
		delta = delta || (any3d ? this.options.zoomDelta : 1);
		return this.setZoom(this._zoom - delta, options);
	},

	// @method setZoomAround(latlng: LatLng, zoom: Number, options: Zoom options): this
	// Zooms the map while keeping a specified geographical point on the map
	// stationary (e.g. used internally for scroll zoom and double-click zoom).
	// @alternative
	// @method setZoomAround(offset: Point, zoom: Number, options: Zoom options): this
	// Zooms the map while keeping a specified pixel on the map (relative to the top-left corner) stationary.
	setZoomAround: function (latlng, zoom, options) {
		var scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlng instanceof Point ? latlng : this.latLngToContainerPoint(latlng),

		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	},

	_getBoundsCenterZoom: function (bounds, options) {

		options = options || {};
		bounds = bounds.getBounds ? bounds.getBounds() : toLatLngBounds(bounds);

		var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]),

		    zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));

		zoom = (typeof options.maxZoom === 'number') ? Math.min(options.maxZoom, zoom) : zoom;

		if (zoom === Infinity) {
			return {
				center: bounds.getCenter(),
				zoom: zoom
			};
		}

		var paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

		    swPoint = this.project(bounds.getSouthWest(), zoom),
		    nePoint = this.project(bounds.getNorthEast(), zoom),
		    center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

		return {
			center: center,
			zoom: zoom
		};
	},

	// @method fitBounds(bounds: LatLngBounds, options?: fitBounds options): this
	// Sets a map view that contains the given geographical bounds with the
	// maximum zoom level possible.
	fitBounds: function (bounds, options) {

		bounds = toLatLngBounds(bounds);

		if (!bounds.isValid()) {
			throw new Error('Bounds are not valid.');
		}

		var target = this._getBoundsCenterZoom(bounds, options);
		return this.setView(target.center, target.zoom, options);
	},

	// @method fitWorld(options?: fitBounds options): this
	// Sets a map view that mostly contains the whole world with the maximum
	// zoom level possible.
	fitWorld: function (options) {
		return this.fitBounds([[-90, -180], [90, 180]], options);
	},

	// @method panTo(latlng: LatLng, options?: Pan options): this
	// Pans the map to a given center.
	panTo: function (center, options) { // (LatLng)
		return this.setView(center, this._zoom, {pan: options});
	},

	// @method panBy(offset: Point, options?: Pan options): this
	// Pans the map by a given number of pixels (animated).
	panBy: function (offset, options) {
		offset = toPoint(offset).round();
		options = options || {};

		if (!offset.x && !offset.y) {
			return this.fire('moveend');
		}
		// If we pan too far, Chrome gets issues with tiles
		// and makes them disappear or appear in the wrong place (slightly offset) #2602
		if (options.animate !== true && !this.getSize().contains(offset)) {
			this._resetView(this.unproject(this.project(this.getCenter()).add(offset)), this.getZoom());
			return this;
		}

		if (!this._panAnim) {
			this._panAnim = new PosAnimation();

			this._panAnim.on({
				'step': this._onPanTransitionStep,
				'end': this._onPanTransitionEnd
			}, this);
		}

		// don't fire movestart if animating inertia
		if (!options.noMoveStart) {
			this.fire('movestart');
		}

		// animate pan unless animate: false specified
		if (options.animate !== false) {
			addClass(this._mapPane, 'leaflet-pan-anim');

			var newPos = this._getMapPanePos().subtract(offset).round();
			this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
		} else {
			this._rawPanBy(offset);
			this.fire('move').fire('moveend');
		}

		return this;
	},

	// @method flyTo(latlng: LatLng, zoom?: Number, options?: Zoom/pan options): this
	// Sets the view of the map (geographical center and zoom) performing a smooth
	// pan-zoom animation.
	flyTo: function (targetCenter, targetZoom, options) {

		options = options || {};
		if (options.animate === false || !any3d) {
			return this.setView(targetCenter, targetZoom, options);
		}

		this._stop();

		var from = this.project(this.getCenter()),
		    to = this.project(targetCenter),
		    size = this.getSize(),
		    startZoom = this._zoom;

		targetCenter = toLatLng(targetCenter);
		targetZoom = targetZoom === undefined ? startZoom : targetZoom;

		var w0 = Math.max(size.x, size.y),
		    w1 = w0 * this.getZoomScale(startZoom, targetZoom),
		    u1 = (to.distanceTo(from)) || 1,
		    rho = 1.42,
		    rho2 = rho * rho;

		function r(i) {
			var s1 = i ? -1 : 1,
			    s2 = i ? w1 : w0,
			    t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1,
			    b1 = 2 * s2 * rho2 * u1,
			    b = t1 / b1,
			    sq = Math.sqrt(b * b + 1) - b;

			    // workaround for floating point precision bug when sq = 0, log = -Infinite,
			    // thus triggering an infinite loop in flyTo
			    var log = sq < 0.000000001 ? -18 : Math.log(sq);

			return log;
		}

		function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
		function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
		function tanh(n) { return sinh(n) / cosh(n); }

		var r0 = r(0);

		function w(s) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); }
		function u(s) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; }

		function easeOut(t) { return 1 - Math.pow(1 - t, 1.5); }

		var start = Date.now(),
		    S = (r(1) - r0) / rho,
		    duration = options.duration ? 1000 * options.duration : 1000 * S * 0.8;

		function frame() {
			var t = (Date.now() - start) / duration,
			    s = easeOut(t) * S;

			if (t <= 1) {
				this._flyToFrame = requestAnimFrame(frame, this);

				this._move(
					this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
					this.getScaleZoom(w0 / w(s), startZoom),
					{flyTo: true});

			} else {
				this
					._move(targetCenter, targetZoom)
					._moveEnd(true);
			}
		}

		this._moveStart(true, options.noMoveStart);

		frame.call(this);
		return this;
	},

	// @method flyToBounds(bounds: LatLngBounds, options?: fitBounds options): this
	// Sets the view of the map with a smooth animation like [`flyTo`](#map-flyto),
	// but takes a bounds parameter like [`fitBounds`](#map-fitbounds).
	flyToBounds: function (bounds, options) {
		var target = this._getBoundsCenterZoom(bounds, options);
		return this.flyTo(target.center, target.zoom, options);
	},

	// @method setMaxBounds(bounds: Bounds): this
	// Restricts the map view to the given bounds (see the [maxBounds](#map-maxbounds) option).
	setMaxBounds: function (bounds) {
		bounds = toLatLngBounds(bounds);

		if (!bounds.isValid()) {
			this.options.maxBounds = null;
			return this.off('moveend', this._panInsideMaxBounds);
		} else if (this.options.maxBounds) {
			this.off('moveend', this._panInsideMaxBounds);
		}

		this.options.maxBounds = bounds;

		if (this._loaded) {
			this._panInsideMaxBounds();
		}

		return this.on('moveend', this._panInsideMaxBounds);
	},

	// @method setMinZoom(zoom: Number): this
	// Sets the lower limit for the available zoom levels (see the [minZoom](#map-minzoom) option).
	setMinZoom: function (zoom) {
		var oldZoom = this.options.minZoom;
		this.options.minZoom = zoom;

		if (this._loaded && oldZoom !== zoom) {
			this.fire('zoomlevelschange');

			if (this.getZoom() < this.options.minZoom) {
				return this.setZoom(zoom);
			}
		}

		return this;
	},

	// @method setMaxZoom(zoom: Number): this
	// Sets the upper limit for the available zoom levels (see the [maxZoom](#map-maxzoom) option).
	setMaxZoom: function (zoom) {
		var oldZoom = this.options.maxZoom;
		this.options.maxZoom = zoom;

		if (this._loaded && oldZoom !== zoom) {
			this.fire('zoomlevelschange');

			if (this.getZoom() > this.options.maxZoom) {
				return this.setZoom(zoom);
			}
		}

		return this;
	},

	// @method panInsideBounds(bounds: LatLngBounds, options?: Pan options): this
	// Pans the map to the closest view that would lie inside the given bounds (if it's not already), controlling the animation using the options specific, if any.
	panInsideBounds: function (bounds, options) {
		this._enforcingBounds = true;
		var center = this.getCenter(),
		    newCenter = this._limitCenter(center, this._zoom, toLatLngBounds(bounds));

		if (!center.equals(newCenter)) {
			this.panTo(newCenter, options);
		}

		this._enforcingBounds = false;
		return this;
	},

	// @method panInside(latlng: LatLng, options?: options): this
	// Pans the map the minimum amount to make the `latlng` visible. Use
	// `padding`, `paddingTopLeft` and `paddingTopRight` options to fit
	// the display to more restricted bounds, like [`fitBounds`](#map-fitbounds).
	// If `latlng` is already within the (optionally padded) display bounds,
	// the map will not be panned.
	panInside: function (latlng, options) {
		options = options || {};

		var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]),
		    center = this.getCenter(),
		    pixelCenter = this.project(center),
		    pixelPoint = this.project(latlng),
		    pixelBounds = this.getPixelBounds(),
		    halfPixelBounds = pixelBounds.getSize().divideBy(2),
		    paddedBounds = toBounds([pixelBounds.min.add(paddingTL), pixelBounds.max.subtract(paddingBR)]);

		if (!paddedBounds.contains(pixelPoint)) {
			this._enforcingBounds = true;
			var diff = pixelCenter.subtract(pixelPoint),
			    newCenter = toPoint(pixelPoint.x + diff.x, pixelPoint.y + diff.y);

			if (pixelPoint.x < paddedBounds.min.x || pixelPoint.x > paddedBounds.max.x) {
				newCenter.x = pixelCenter.x - diff.x;
				if (diff.x > 0) {
					newCenter.x += halfPixelBounds.x - paddingTL.x;
				} else {
					newCenter.x -= halfPixelBounds.x - paddingBR.x;
				}
			}
			if (pixelPoint.y < paddedBounds.min.y || pixelPoint.y > paddedBounds.max.y) {
				newCenter.y = pixelCenter.y - diff.y;
				if (diff.y > 0) {
					newCenter.y += halfPixelBounds.y - paddingTL.y;
				} else {
					newCenter.y -= halfPixelBounds.y - paddingBR.y;
				}
			}
			this.panTo(this.unproject(newCenter), options);
			this._enforcingBounds = false;
		}
		return this;
	},

	// @method invalidateSize(options: Zoom/pan options): this
	// Checks if the map container size changed and updates the map if so —
	// call it after you've changed the map size dynamically, also animating
	// pan by default. If `options.pan` is `false`, panning will not occur.
	// If `options.debounceMoveend` is `true`, it will delay `moveend` event so
	// that it doesn't happen often even if the method is called many
	// times in a row.

	// @alternative
	// @method invalidateSize(animate: Boolean): this
	// Checks if the map container size changed and updates the map if so —
	// call it after you've changed the map size dynamically, also animating
	// pan by default.
	invalidateSize: function (options) {
		if (!this._loaded) { return this; }

		options = extend({
			animate: false,
			pan: true
		}, options === true ? {animate: true} : options);

		var oldSize = this.getSize();
		this._sizeChanged = true;
		this._lastCenter = null;

		var newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(bind(this.fire, this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		// @section Map state change events
		// @event resize: ResizeEvent
		// Fired when the map is resized.
		return this.fire('resize', {
			oldSize: oldSize,
			newSize: newSize
		});
	},

	// @section Methods for modifying map state
	// @method stop(): this
	// Stops the currently running `panTo` or `flyTo` animation, if any.
	stop: function () {
		this.setZoom(this._limitZoom(this._zoom));
		if (!this.options.zoomSnap) {
			this.fire('viewreset');
		}
		return this._stop();
	},

	// @section Geolocation methods
	// @method locate(options?: Locate options): this
	// Tries to locate the user using the Geolocation API, firing a [`locationfound`](#map-locationfound)
	// event with location data on success or a [`locationerror`](#map-locationerror) event on failure,
	// and optionally sets the map view to the user's location with respect to
	// detection accuracy (or to the world view if geolocation failed).
	// Note that, if your page doesn't use HTTPS, this method will fail in
	// modern browsers ([Chrome 50 and newer](https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-powerful-features-on-insecure-origins))
	// See `Locate options` for more details.
	locate: function (options) {

		options = this._locateOptions = extend({
			timeout: 10000,
			watch: false
			// setView: false
			// maxZoom: <Number>
			// maximumAge: 0
			// enableHighAccuracy: false
		}, options);

		if (!('geolocation' in navigator)) {
			this._handleGeolocationError({
				code: 0,
				message: 'Geolocation not supported.'
			});
			return this;
		}

		var onResponse = bind(this._handleGeolocationResponse, this),
		    onError = bind(this._handleGeolocationError, this);

		if (options.watch) {
			this._locationWatchId =
			        navigator.geolocation.watchPosition(onResponse, onError, options);
		} else {
			navigator.geolocation.getCurrentPosition(onResponse, onError, options);
		}
		return this;
	},

	// @method stopLocate(): this
	// Stops watching location previously initiated by `map.locate({watch: true})`
	// and aborts resetting the map view if map.locate was called with
	// `{setView: true}`.
	stopLocate: function () {
		if (navigator.geolocation && navigator.geolocation.clearWatch) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		if (this._locateOptions) {
			this._locateOptions.setView = false;
		}
		return this;
	},

	_handleGeolocationError: function (error) {
		var c = error.code,
		    message = error.message ||
		            (c === 1 ? 'permission denied' :
		            (c === 2 ? 'position unavailable' : 'timeout'));

		if (this._locateOptions.setView && !this._loaded) {
			this.fitWorld();
		}

		// @section Location events
		// @event locationerror: ErrorEvent
		// Fired when geolocation (using the [`locate`](#map-locate) method) failed.
		this.fire('locationerror', {
			code: c,
			message: 'Geolocation error: ' + message + '.'
		});
	},

	_handleGeolocationResponse: function (pos) {
		var lat = pos.coords.latitude,
		    lng = pos.coords.longitude,
		    latlng = new LatLng(lat, lng),
		    bounds = latlng.toBounds(pos.coords.accuracy * 2),
		    options = this._locateOptions;

		if (options.setView) {
			var zoom = this.getBoundsZoom(bounds);
			this.setView(latlng, options.maxZoom ? Math.min(zoom, options.maxZoom) : zoom);
		}

		var data = {
			latlng: latlng,
			bounds: bounds,
			timestamp: pos.timestamp
		};

		for (var i in pos.coords) {
			if (typeof pos.coords[i] === 'number') {
				data[i] = pos.coords[i];
			}
		}

		// @event locationfound: LocationEvent
		// Fired when geolocation (using the [`locate`](#map-locate) method)
		// went successfully.
		this.fire('locationfound', data);
	},

	// TODO Appropriate docs section?
	// @section Other Methods
	// @method addHandler(name: String, HandlerClass: Function): this
	// Adds a new `Handler` to the map, given its name and constructor function.
	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return this; }

		var handler = this[name] = new HandlerClass(this);

		this._handlers.push(handler);

		if (this.options[name]) {
			handler.enable();
		}

		return this;
	},

	// @method remove(): this
	// Destroys the map and clears all related event listeners.
	remove: function () {

		this._initEvents(true);

		if (this._containerId !== this._container._leaflet_id) {
			throw new Error('Map container is being reused by another instance');
		}

		try {
			// throws error in IE6-8
			delete this._container._leaflet_id;
			delete this._containerId;
		} catch (e) {
			/*eslint-disable */
			this._container._leaflet_id = undefined;
			/* eslint-enable */
			this._containerId = undefined;
		}

		if (this._locationWatchId !== undefined) {
			this.stopLocate();
		}

		this._stop();

		remove(this._mapPane);

		if (this._clearControlPos) {
			this._clearControlPos();
		}
		if (this._resizeRequest) {
			cancelAnimFrame(this._resizeRequest);
			this._resizeRequest = null;
		}

		this._clearHandlers();

		if (this._loaded) {
			// @section Map state change events
			// @event unload: Event
			// Fired when the map is destroyed with [remove](#map-remove) method.
			this.fire('unload');
		}

		var i;
		for (i in this._layers) {
			this._layers[i].remove();
		}
		for (i in this._panes) {
			remove(this._panes[i]);
		}

		this._layers = [];
		this._panes = [];
		delete this._mapPane;
		delete this._renderer;

		return this;
	},

	// @section Other Methods
	// @method createPane(name: String, container?: HTMLElement): HTMLElement
	// Creates a new [map pane](#map-pane) with the given name if it doesn't exist already,
	// then returns it. The pane is created as a child of `container`, or
	// as a child of the main map pane if not set.
	createPane: function (name, container) {
		var className = 'leaflet-pane' + (name ? ' leaflet-' + name.replace('Pane', '') + '-pane' : ''),
		    pane = create$1('div', className, container || this._mapPane);

		if (name) {
			this._panes[name] = pane;
		}
		return pane;
	},

	// @section Methods for Getting Map State

	// @method getCenter(): LatLng
	// Returns the geographical center of the map view
	getCenter: function () {
		this._checkIfLoaded();

		if (this._lastCenter && !this._moved()) {
			return this._lastCenter;
		}
		return this.layerPointToLatLng(this._getCenterLayerPoint());
	},

	// @method getZoom(): Number
	// Returns the current zoom level of the map view
	getZoom: function () {
		return this._zoom;
	},

	// @method getBounds(): LatLngBounds
	// Returns the geographical bounds visible in the current map view
	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new LatLngBounds(sw, ne);
	},

	// @method getMinZoom(): Number
	// Returns the minimum zoom level of the map (if set in the `minZoom` option of the map or of any layers), or `0` by default.
	getMinZoom: function () {
		return this.options.minZoom === undefined ? this._layersMinZoom || 0 : this.options.minZoom;
	},

	// @method getMaxZoom(): Number
	// Returns the maximum zoom level of the map (if set in the `maxZoom` option of the map or of any layers).
	getMaxZoom: function () {
		return this.options.maxZoom === undefined ?
			(this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
			this.options.maxZoom;
	},

	// @method getBoundsZoom(bounds: LatLngBounds, inside?: Boolean, padding?: Point): Number
	// Returns the maximum zoom level on which the given bounds fit to the map
	// view in its entirety. If `inside` (optional) is set to `true`, the method
	// instead returns the minimum zoom level on which the map view fits into
	// the given bounds in its entirety.
	getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
		bounds = toLatLngBounds(bounds);
		padding = toPoint(padding || [0, 0]);

		var zoom = this.getZoom() || 0,
		    min = this.getMinZoom(),
		    max = this.getMaxZoom(),
		    nw = bounds.getNorthWest(),
		    se = bounds.getSouthEast(),
		    size = this.getSize().subtract(padding),
		    boundsSize = toBounds(this.project(se, zoom), this.project(nw, zoom)).getSize(),
		    snap = any3d ? this.options.zoomSnap : 1,
		    scalex = size.x / boundsSize.x,
		    scaley = size.y / boundsSize.y,
		    scale = inside ? Math.max(scalex, scaley) : Math.min(scalex, scaley);

		zoom = this.getScaleZoom(scale, zoom);

		if (snap) {
			zoom = Math.round(zoom / (snap / 100)) * (snap / 100); // don't jump if within 1% of a snap level
			zoom = inside ? Math.ceil(zoom / snap) * snap : Math.floor(zoom / snap) * snap;
		}

		return Math.max(min, Math.min(max, zoom));
	},

	// @method getSize(): Point
	// Returns the current size of the map container (in pixels).
	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new Point(
				this._container.clientWidth || 0,
				this._container.clientHeight || 0);

			this._sizeChanged = false;
		}
		return this._size.clone();
	},

	// @method getPixelBounds(): Bounds
	// Returns the bounds of the current map view in projected pixel
	// coordinates (sometimes useful in layer and overlay implementations).
	getPixelBounds: function (center, zoom) {
		var topLeftPoint = this._getTopLeftPoint(center, zoom);
		return new Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	// TODO: Check semantics - isn't the pixel origin the 0,0 coord relative to
	// the map pane? "left point of the map layer" can be confusing, specially
	// since there can be negative offsets.
	// @method getPixelOrigin(): Point
	// Returns the projected pixel coordinates of the top left point of
	// the map layer (useful in custom layer and overlay implementations).
	getPixelOrigin: function () {
		this._checkIfLoaded();
		return this._pixelOrigin;
	},

	// @method getPixelWorldBounds(zoom?: Number): Bounds
	// Returns the world's bounds in pixel coordinates for zoom level `zoom`.
	// If `zoom` is omitted, the map's current zoom level is used.
	getPixelWorldBounds: function (zoom) {
		return this.options.crs.getProjectedBounds(zoom === undefined ? this.getZoom() : zoom);
	},

	// @section Other Methods

	// @method getPane(pane: String|HTMLElement): HTMLElement
	// Returns a [map pane](#map-pane), given its name or its HTML element (its identity).
	getPane: function (pane) {
		return typeof pane === 'string' ? this._panes[pane] : pane;
	},

	// @method getPanes(): Object
	// Returns a plain object containing the names of all [panes](#map-pane) as keys and
	// the panes as values.
	getPanes: function () {
		return this._panes;
	},

	// @method getContainer: HTMLElement
	// Returns the HTML element that contains the map.
	getContainer: function () {
		return this._container;
	},


	// @section Conversion Methods

	// @method getZoomScale(toZoom: Number, fromZoom: Number): Number
	// Returns the scale factor to be applied to a map transition from zoom level
	// `fromZoom` to `toZoom`. Used internally to help with zoom animations.
	getZoomScale: function (toZoom, fromZoom) {
		// TODO replace with universal implementation after refactoring projections
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		return crs.scale(toZoom) / crs.scale(fromZoom);
	},

	// @method getScaleZoom(scale: Number, fromZoom: Number): Number
	// Returns the zoom level that the map would end up at, if it is at `fromZoom`
	// level and everything is scaled by a factor of `scale`. Inverse of
	// [`getZoomScale`](#map-getZoomScale).
	getScaleZoom: function (scale, fromZoom) {
		var crs = this.options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		var zoom = crs.zoom(scale * crs.scale(fromZoom));
		return isNaN(zoom) ? Infinity : zoom;
	},

	// @method project(latlng: LatLng, zoom: Number): Point
	// Projects a geographical coordinate `LatLng` according to the projection
	// of the map's CRS, then scales it according to `zoom` and the CRS's
	// `Transformation`. The result is pixel coordinate relative to
	// the CRS origin.
	project: function (latlng, zoom) {
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.latLngToPoint(toLatLng(latlng), zoom);
	},

	// @method unproject(point: Point, zoom: Number): LatLng
	// Inverse of [`project`](#map-project).
	unproject: function (point, zoom) {
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(toPoint(point), zoom);
	},

	// @method layerPointToLatLng(point: Point): LatLng
	// Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
	// returns the corresponding geographical coordinate (for the current zoom level).
	layerPointToLatLng: function (point) {
		var projectedPoint = toPoint(point).add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	},

	// @method latLngToLayerPoint(latlng: LatLng): Point
	// Given a geographical coordinate, returns the corresponding pixel coordinate
	// relative to the [origin pixel](#map-getpixelorigin).
	latLngToLayerPoint: function (latlng) {
		var projectedPoint = this.project(toLatLng(latlng))._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	},

	// @method wrapLatLng(latlng: LatLng): LatLng
	// Returns a `LatLng` where `lat` and `lng` has been wrapped according to the
	// map's CRS's `wrapLat` and `wrapLng` properties, if they are outside the
	// CRS's bounds.
	// By default this means longitude is wrapped around the dateline so its
	// value is between -180 and +180 degrees.
	wrapLatLng: function (latlng) {
		return this.options.crs.wrapLatLng(toLatLng(latlng));
	},

	// @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
	// Returns a `LatLngBounds` with the same size as the given one, ensuring that
	// its center is within the CRS's bounds.
	// By default this means the center longitude is wrapped around the dateline so its
	// value is between -180 and +180 degrees, and the majority of the bounds
	// overlaps the CRS's bounds.
	wrapLatLngBounds: function (latlng) {
		return this.options.crs.wrapLatLngBounds(toLatLngBounds(latlng));
	},

	// @method distance(latlng1: LatLng, latlng2: LatLng): Number
	// Returns the distance between two geographical coordinates according to
	// the map's CRS. By default this measures distance in meters.
	distance: function (latlng1, latlng2) {
		return this.options.crs.distance(toLatLng(latlng1), toLatLng(latlng2));
	},

	// @method containerPointToLayerPoint(point: Point): Point
	// Given a pixel coordinate relative to the map container, returns the corresponding
	// pixel coordinate relative to the [origin pixel](#map-getpixelorigin).
	containerPointToLayerPoint: function (point) { // (Point)
		return toPoint(point).subtract(this._getMapPanePos());
	},

	// @method layerPointToContainerPoint(point: Point): Point
	// Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
	// returns the corresponding pixel coordinate relative to the map container.
	layerPointToContainerPoint: function (point) { // (Point)
		return toPoint(point).add(this._getMapPanePos());
	},

	// @method containerPointToLatLng(point: Point): LatLng
	// Given a pixel coordinate relative to the map container, returns
	// the corresponding geographical coordinate (for the current zoom level).
	containerPointToLatLng: function (point) {
		var layerPoint = this.containerPointToLayerPoint(toPoint(point));
		return this.layerPointToLatLng(layerPoint);
	},

	// @method latLngToContainerPoint(latlng: LatLng): Point
	// Given a geographical coordinate, returns the corresponding pixel coordinate
	// relative to the map container.
	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(toLatLng(latlng)));
	},

	// @method mouseEventToContainerPoint(ev: MouseEvent): Point
	// Given a MouseEvent object, returns the pixel coordinate relative to the
	// map container where the event took place.
	mouseEventToContainerPoint: function (e) {
		return getMousePosition(e, this._container);
	},

	// @method mouseEventToLayerPoint(ev: MouseEvent): Point
	// Given a MouseEvent object, returns the pixel coordinate relative to
	// the [origin pixel](#map-getpixelorigin) where the event took place.
	mouseEventToLayerPoint: function (e) {
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	// @method mouseEventToLatLng(ev: MouseEvent): LatLng
	// Given a MouseEvent object, returns geographical coordinate where the
	// event took place.
	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},


	// map initialization methods

	_initContainer: function (id) {
		var container = this._container = get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet_id) {
			throw new Error('Map container is already initialized.');
		}

		on(container, 'scroll', this._onScroll, this);
		this._containerId = stamp(container);
	},

	_initLayout: function () {
		var container = this._container;

		this._fadeAnimated = this.options.fadeAnimation && any3d;

		addClass(container, 'leaflet-container' +
			(touch ? ' leaflet-touch' : '') +
			(retina ? ' leaflet-retina' : '') +
			(ielt9 ? ' leaflet-oldie' : '') +
			(safari ? ' leaflet-safari' : '') +
			(this._fadeAnimated ? ' leaflet-fade-anim' : ''));

		var position = getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
			container.style.position = 'relative';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};
		this._paneRenderers = {};

		// @section
		//
		// Panes are DOM elements used to control the ordering of layers on the map. You
		// can access panes with [`map.getPane`](#map-getpane) or
		// [`map.getPanes`](#map-getpanes) methods. New panes can be created with the
		// [`map.createPane`](#map-createpane) method.
		//
		// Every map has the following default panes that differ only in zIndex.
		//
		// @pane mapPane: HTMLElement = 'auto'
		// Pane that contains all other map panes

		this._mapPane = this.createPane('mapPane', this._container);
		setPosition(this._mapPane, new Point(0, 0));

		// @pane tilePane: HTMLElement = 200
		// Pane for `GridLayer`s and `TileLayer`s
		this.createPane('tilePane');
		// @pane overlayPane: HTMLElement = 400
		// Pane for vectors (`Path`s, like `Polyline`s and `Polygon`s), `ImageOverlay`s and `VideoOverlay`s
		this.createPane('shadowPane');
		// @pane shadowPane: HTMLElement = 500
		// Pane for overlay shadows (e.g. `Marker` shadows)
		this.createPane('overlayPane');
		// @pane markerPane: HTMLElement = 600
		// Pane for `Icon`s of `Marker`s
		this.createPane('markerPane');
		// @pane tooltipPane: HTMLElement = 650
		// Pane for `Tooltip`s.
		this.createPane('tooltipPane');
		// @pane popupPane: HTMLElement = 700
		// Pane for `Popup`s.
		this.createPane('popupPane');

		if (!this.options.markerZoomAnimation) {
			addClass(panes.markerPane, 'leaflet-zoom-hide');
			addClass(panes.shadowPane, 'leaflet-zoom-hide');
		}
	},


	// private methods that modify map state

	// @section Map state change events
	_resetView: function (center, zoom) {
		setPosition(this._mapPane, new Point(0, 0));

		var loading = !this._loaded;
		this._loaded = true;
		zoom = this._limitZoom(zoom);

		this.fire('viewprereset');

		var zoomChanged = this._zoom !== zoom;
		this
			._moveStart(zoomChanged, false)
			._move(center, zoom)
			._moveEnd(zoomChanged);

		// @event viewreset: Event
		// Fired when the map needs to redraw its content (this usually happens
		// on map zoom or load). Very useful for creating custom overlays.
		this.fire('viewreset');

		// @event load: Event
		// Fired when the map is initialized (when its center and zoom are set
		// for the first time).
		if (loading) {
			this.fire('load');
		}
	},

	_moveStart: function (zoomChanged, noMoveStart) {
		// @event zoomstart: Event
		// Fired when the map zoom is about to change (e.g. before zoom animation).
		// @event movestart: Event
		// Fired when the view of the map starts changing (e.g. user starts dragging the map).
		if (zoomChanged) {
			this.fire('zoomstart');
		}
		if (!noMoveStart) {
			this.fire('movestart');
		}
		return this;
	},

	_move: function (center, zoom, data) {
		if (zoom === undefined) {
			zoom = this._zoom;
		}
		var zoomChanged = this._zoom !== zoom;

		this._zoom = zoom;
		this._lastCenter = center;
		this._pixelOrigin = this._getNewPixelOrigin(center);

		// @event zoom: Event
		// Fired repeatedly during any change in zoom level, including zoom
		// and fly animations.
		if (zoomChanged || (data && data.pinch)) {	// Always fire 'zoom' if pinching because #3530
			this.fire('zoom', data);
		}

		// @event move: Event
		// Fired repeatedly during any movement of the map, including pan and
		// fly animations.
		return this.fire('move', data);
	},

	_moveEnd: function (zoomChanged) {
		// @event zoomend: Event
		// Fired when the map has changed, after any animations.
		if (zoomChanged) {
			this.fire('zoomend');
		}

		// @event moveend: Event
		// Fired when the center of the map stops changing (e.g. user stopped
		// dragging the map).
		return this.fire('moveend');
	},

	_stop: function () {
		cancelAnimFrame(this._flyToFrame);
		if (this._panAnim) {
			this._panAnim.stop();
		}
		return this;
	},

	_rawPanBy: function (offset) {
		setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	},

	_getZoomSpan: function () {
		return this.getMaxZoom() - this.getMinZoom();
	},

	_panInsideMaxBounds: function () {
		if (!this._enforcingBounds) {
			this.panInsideBounds(this.options.maxBounds);
		}
	},

	_checkIfLoaded: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	},

	// DOM event handling

	// @section Interaction events
	_initEvents: function (remove$$1) {
		this._targets = {};
		this._targets[stamp(this._container)] = this;

		var onOff = remove$$1 ? off : on;

		// @event click: MouseEvent
		// Fired when the user clicks (or taps) the map.
		// @event dblclick: MouseEvent
		// Fired when the user double-clicks (or double-taps) the map.
		// @event mousedown: MouseEvent
		// Fired when the user pushes the mouse button on the map.
		// @event mouseup: MouseEvent
		// Fired when the user releases the mouse button on the map.
		// @event mouseover: MouseEvent
		// Fired when the mouse enters the map.
		// @event mouseout: MouseEvent
		// Fired when the mouse leaves the map.
		// @event mousemove: MouseEvent
		// Fired while the mouse moves over the map.
		// @event contextmenu: MouseEvent
		// Fired when the user pushes the right mouse button on the map, prevents
		// default browser context menu from showing if there are listeners on
		// this event. Also fired on mobile when the user holds a single touch
		// for a second (also called long press).
		// @event keypress: KeyboardEvent
		// Fired when the user presses a key from the keyboard that produces a character value while the map is focused.
		// @event keydown: KeyboardEvent
		// Fired when the user presses a key from the keyboard while the map is focused. Unlike the `keypress` event,
		// the `keydown` event is fired for keys that produce a character value and for keys
		// that do not produce a character value.
		// @event keyup: KeyboardEvent
		// Fired when the user releases a key from the keyboard while the map is focused.
		onOff(this._container, 'click dblclick mousedown mouseup ' +
			'mouseover mouseout mousemove contextmenu keypress keydown keyup', this._handleDOMEvent, this);

		if (this.options.trackResize) {
			onOff(window, 'resize', this._onResize, this);
		}

		if (any3d && this.options.transform3DLimit) {
			(remove$$1 ? this.off : this.on).call(this, 'moveend', this._onMoveEnd);
		}
	},

	_onResize: function () {
		cancelAnimFrame(this._resizeRequest);
		this._resizeRequest = requestAnimFrame(
		        function () { this.invalidateSize({debounceMoveend: true}); }, this);
	},

	_onScroll: function () {
		this._container.scrollTop  = 0;
		this._container.scrollLeft = 0;
	},

	_onMoveEnd: function () {
		var pos = this._getMapPanePos();
		if (Math.max(Math.abs(pos.x), Math.abs(pos.y)) >= this.options.transform3DLimit) {
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1203873 but Webkit also have
			// a pixel offset on very high values, see: http://jsfiddle.net/dg6r5hhb/
			this._resetView(this.getCenter(), this.getZoom());
		}
	},

	_findEventTargets: function (e, type) {
		var targets = [],
		    target,
		    isHover = type === 'mouseout' || type === 'mouseover',
		    src = e.target || e.srcElement,
		    dragging = false;

		while (src) {
			target = this._targets[stamp(src)];
			if (target && (type === 'click' || type === 'preclick') && !e._simulated && this._draggableMoved(target)) {
				// Prevent firing click after you just dragged an object.
				dragging = true;
				break;
			}
			if (target && target.listens(type, true)) {
				if (isHover && !isExternalTarget(src, e)) { break; }
				targets.push(target);
				if (isHover) { break; }
			}
			if (src === this._container) { break; }
			src = src.parentNode;
		}
		if (!targets.length && !dragging && !isHover && isExternalTarget(src, e)) {
			targets = [this];
		}
		return targets;
	},

	_handleDOMEvent: function (e) {
		if (!this._loaded || skipped(e)) { return; }

		var type = e.type;

		if (type === 'mousedown' || type === 'keypress' || type === 'keyup' || type === 'keydown') {
			// prevents outline when clicking on keyboard-focusable element
			preventOutline(e.target || e.srcElement);
		}

		this._fireDOMEvent(e, type);
	},

	_mouseEvents: ['click', 'dblclick', 'mouseover', 'mouseout', 'contextmenu'],

	_fireDOMEvent: function (e, type, targets) {

		if (e.type === 'click') {
			// Fire a synthetic 'preclick' event which propagates up (mainly for closing popups).
			// @event preclick: MouseEvent
			// Fired before mouse click on the map (sometimes useful when you
			// want something to happen on click before any existing click
			// handlers start running).
			var synth = extend({}, e);
			synth.type = 'preclick';
			this._fireDOMEvent(synth, synth.type, targets);
		}

		if (e._stopped) { return; }

		// Find the layer the event is propagating from and its parents.
		targets = (targets || []).concat(this._findEventTargets(e, type));

		if (!targets.length) { return; }

		var target = targets[0];
		if (type === 'contextmenu' && target.listens(type, true)) {
			preventDefault(e);
		}

		var data = {
			originalEvent: e
		};

		if (e.type !== 'keypress' && e.type !== 'keydown' && e.type !== 'keyup') {
			var isMarker = target.getLatLng && (!target._radius || target._radius <= 10);
			data.containerPoint = isMarker ?
				this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
			data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
			data.latlng = isMarker ? target.getLatLng() : this.layerPointToLatLng(data.layerPoint);
		}

		for (var i = 0; i < targets.length; i++) {
			targets[i].fire(type, data, true);
			if (data.originalEvent._stopped ||
				(targets[i].options.bubblingMouseEvents === false && indexOf(this._mouseEvents, type) !== -1)) { return; }
		}
	},

	_draggableMoved: function (obj) {
		obj = obj.dragging && obj.dragging.enabled() ? obj : this;
		return (obj.dragging && obj.dragging.moved()) || (this.boxZoom && this.boxZoom.moved());
	},

	_clearHandlers: function () {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}
	},

	// @section Other Methods

	// @method whenReady(fn: Function, context?: Object): this
	// Runs the given function `fn` when the map gets initialized with
	// a view (center and zoom) and at least one layer, or immediately
	// if it's already initialized, optionally passing a function context.
	whenReady: function (callback, context) {
		if (this._loaded) {
			callback.call(context || this, {target: this});
		} else {
			this.on('load', callback, context);
		}
		return this;
	},


	// private methods for getting map state

	_getMapPanePos: function () {
		return getPosition(this._mapPane) || new Point(0, 0);
	},

	_moved: function () {
		var pos = this._getMapPanePos();
		return pos && !pos.equals([0, 0]);
	},

	_getTopLeftPoint: function (center, zoom) {
		var pixelOrigin = center && zoom !== undefined ?
			this._getNewPixelOrigin(center, zoom) :
			this.getPixelOrigin();
		return pixelOrigin.subtract(this._getMapPanePos());
	},

	_getNewPixelOrigin: function (center, zoom) {
		var viewHalf = this.getSize()._divideBy(2);
		return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._round();
	},

	_latLngToNewLayerPoint: function (latlng, zoom, center) {
		var topLeft = this._getNewPixelOrigin(center, zoom);
		return this.project(latlng, zoom)._subtract(topLeft);
	},

	_latLngBoundsToNewLayerBounds: function (latLngBounds, zoom, center) {
		var topLeft = this._getNewPixelOrigin(center, zoom);
		return toBounds([
			this.project(latLngBounds.getSouthWest(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getNorthWest(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getSouthEast(), zoom)._subtract(topLeft),
			this.project(latLngBounds.getNorthEast(), zoom)._subtract(topLeft)
		]);
	},

	// layer point of the current center
	_getCenterLayerPoint: function () {
		return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
	},

	// offset of the specified place to the current center in pixels
	_getCenterOffset: function (latlng) {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	},

	// adjust center for view to get inside bounds
	_limitCenter: function (center, zoom, bounds) {

		if (!bounds) { return center; }

		var centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		// If offset is less than a pixel, ignore.
		// This prevents unstable projections from getting into
		// an infinite loop of tiny offsets.
		if (offset.round().equals([0, 0])) {
			return center;
		}

		return this.unproject(centerPoint.add(offset), zoom);
	},

	// adjust offset for view to get inside bounds
	_limitOffset: function (offset, bounds) {
		if (!bounds) { return offset; }

		var viewBounds = this.getPixelBounds(),
		    newBounds = new Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

		return offset.add(this._getBoundsOffset(newBounds, bounds));
	},

	// returns offset needed for pxBounds to get inside maxBounds at a specified zoom
	_getBoundsOffset: function (pxBounds, maxBounds, zoom) {
		var projectedMaxBounds = toBounds(
		        this.project(maxBounds.getNorthEast(), zoom),
		        this.project(maxBounds.getSouthWest(), zoom)
		    ),
		    minOffset = projectedMaxBounds.min.subtract(pxBounds.min),
		    maxOffset = projectedMaxBounds.max.subtract(pxBounds.max),

		    dx = this._rebound(minOffset.x, -maxOffset.x),
		    dy = this._rebound(minOffset.y, -maxOffset.y);

		return new Point(dx, dy);
	},

	_rebound: function (left, right) {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
		    max = this.getMaxZoom(),
		    snap = any3d ? this.options.zoomSnap : 1;
		if (snap) {
			zoom = Math.round(zoom / snap) * snap;
		}
		return Math.max(min, Math.min(max, zoom));
	},

	_onPanTransitionStep: function () {
		this.fire('move');
	},

	_onPanTransitionEnd: function () {
		removeClass(this._mapPane, 'leaflet-pan-anim');
		this.fire('moveend');
	},

	_tryAnimatedPan: function (center, options) {
		// difference between the new and current centers in pixels
		var offset = this._getCenterOffset(center)._trunc();

		// don't animate too far unless animate: true specified in options
		if ((options && options.animate) !== true && !this.getSize().contains(offset)) { return false; }

		this.panBy(offset, options);

		return true;
	},

	_createAnimProxy: function () {

		var proxy = this._proxy = create$1('div', 'leaflet-proxy leaflet-zoom-animated');
		this._panes.mapPane.appendChild(proxy);

		this.on('zoomanim', function (e) {
			var prop = TRANSFORM,
			    transform = this._proxy.style[prop];

			setTransform(this._proxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));

			// workaround for case when transform is the same and so transitionend event is not fired
			if (transform === this._proxy.style[prop] && this._animatingZoom) {
				this._onZoomTransitionEnd();
			}
		}, this);

		this.on('load moveend', function () {
			var c = this.getCenter(),
			    z = this.getZoom();
			setTransform(this._proxy, this.project(c, z), this.getZoomScale(z, 1));
		}, this);

		this._on('unload', this._destroyAnimProxy, this);
	},

	_destroyAnimProxy: function () {
		remove(this._proxy);
		delete this._proxy;
	},

	_catchTransitionEnd: function (e) {
		if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
			this._onZoomTransitionEnd();
		}
	},

	_nothingToAnimate: function () {
		return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
	},

	_tryAnimatedZoom: function (center, zoom, options) {

		if (this._animatingZoom) { return true; }

		options = options || {};

		// don't animate if disabled, not supported or zoom difference is too large
		if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
		        Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) { return false; }

		// offset is the pixel coords of the zoom origin relative to the current center
		var scale = this.getZoomScale(zoom),
		    offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale);

		// don't animate if the zoom origin isn't within one screen from the current center, unless forced
		if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

		requestAnimFrame(function () {
			this
			    ._moveStart(true, false)
			    ._animateZoom(center, zoom, true);
		}, this);

		return true;
	},

	_animateZoom: function (center, zoom, startAnim, noUpdate) {
		if (!this._mapPane) { return; }

		if (startAnim) {
			this._animatingZoom = true;

			// remember what center/zoom to set after animation
			this._animateToCenter = center;
			this._animateToZoom = zoom;

			addClass(this._mapPane, 'leaflet-zoom-anim');
		}

		// @event zoomanim: ZoomAnimEvent
		// Fired at least once per zoom animation. For continuous zoom, like pinch zooming, fired once per frame during zoom.
		this.fire('zoomanim', {
			center: center,
			zoom: zoom,
			noUpdate: noUpdate
		});

		// Work around webkit not firing 'transitionend', see https://github.com/Leaflet/Leaflet/issues/3689, 2693
		setTimeout(bind(this._onZoomTransitionEnd, this), 250);
	},

	_onZoomTransitionEnd: function () {
		if (!this._animatingZoom) { return; }

		if (this._mapPane) {
			removeClass(this._mapPane, 'leaflet-zoom-anim');
		}

		this._animatingZoom = false;

		this._move(this._animateToCenter, this._animateToZoom);

		// This anim frame should prevent an obscure iOS webkit tile loading race condition.
		requestAnimFrame(function () {
			this._moveEnd(true);
		}, this);
	}
});

// @section

// @factory L.map(id: String, options?: Map options)
// Instantiates a map object given the DOM ID of a `<div>` element
// and optionally an object literal with `Map options`.
//
// @alternative
// @factory L.map(el: HTMLElement, options?: Map options)
// Instantiates a map object given an instance of a `<div>` HTML element
// and optionally an object literal with `Map options`.
function createMap(id, options) {
	return new Map(id, options);
}

/*
 * @class Control
 * @aka L.Control
 * @inherits Class
 *
 * L.Control is a base class for implementing map controls. Handles positioning.
 * All other controls extend from this class.
 */

var Control = Class.extend({
	// @section
	// @aka Control options
	options: {
		// @option position: String = 'topright'
		// The position of the control (one of the map corners). Possible values are `'topleft'`,
		// `'topright'`, `'bottomleft'` or `'bottomright'`
		position: 'topright'
	},

	initialize: function (options) {
		setOptions(this, options);
	},

	/* @section
	 * Classes extending L.Control will inherit the following methods:
	 *
	 * @method getPosition: string
	 * Returns the position of the control.
	 */
	getPosition: function () {
		return this.options.position;
	},

	// @method setPosition(position: string): this
	// Sets the position of the control.
	setPosition: function (position) {
		var map = this._map;

		if (map) {
			map.removeControl(this);
		}

		this.options.position = position;

		if (map) {
			map.addControl(this);
		}

		return this;
	},

	// @method getContainer: HTMLElement
	// Returns the HTMLElement that contains the control.
	getContainer: function () {
		return this._container;
	},

	// @method addTo(map: Map): this
	// Adds the control to the given map.
	addTo: function (map) {
		this.remove();
		this._map = map;

		var container = this._container = this.onAdd(map),
		    pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		addClass(container, 'leaflet-control');

		if (pos.indexOf('bottom') !== -1) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}

		this._map.on('unload', this.remove, this);

		return this;
	},

	// @method remove: this
	// Removes the control from the map it is currently active on.
	remove: function () {
		if (!this._map) {
			return this;
		}

		remove(this._container);

		if (this.onRemove) {
			this.onRemove(this._map);
		}

		this._map.off('unload', this.remove, this);
		this._map = null;

		return this;
	},

	_refocusOnMap: function (e) {
		// if map exists and event is not a keyboard event
		if (this._map && e && e.screenX > 0 && e.screenY > 0) {
			this._map.getContainer().focus();
		}
	}
});

var control = function (options) {
	return new Control(options);
};

/* @section Extension methods
 * @uninheritable
 *
 * Every control should extend from `L.Control` and (re-)implement the following methods.
 *
 * @method onAdd(map: Map): HTMLElement
 * Should return the container DOM element for the control and add listeners on relevant map events. Called on [`control.addTo(map)`](#control-addTo).
 *
 * @method onRemove(map: Map)
 * Optional method. Should contain all clean up code that removes the listeners previously added in [`onAdd`](#control-onadd). Called on [`control.remove()`](#control-remove).
 */

/* @namespace Map
 * @section Methods for Layers and Controls
 */
Map.include({
	// @method addControl(control: Control): this
	// Adds the given control to the map
	addControl: function (control) {
		control.addTo(this);
		return this;
	},

	// @method removeControl(control: Control): this
	// Removes the given control from the map
	removeControl: function (control) {
		control.remove();
		return this;
	},

	_initControlPos: function () {
		var corners = this._controlCorners = {},
		    l = 'leaflet-',
		    container = this._controlContainer =
		            create$1('div', l + 'control-container', this._container);

		function createCorner(vSide, hSide) {
			var className = l + vSide + ' ' + l + hSide;

			corners[vSide + hSide] = create$1('div', className, container);
		}

		createCorner('top', 'left');
		createCorner('top', 'right');
		createCorner('bottom', 'left');
		createCorner('bottom', 'right');
	},

	_clearControlPos: function () {
		for (var i in this._controlCorners) {
			remove(this._controlCorners[i]);
		}
		remove(this._controlContainer);
		delete this._controlCorners;
		delete this._controlContainer;
	}
});

/*
 * @class Control.Layers
 * @aka L.Control.Layers
 * @inherits Control
 *
 * The layers control gives users the ability to switch between different base layers and switch overlays on/off (check out the [detailed example](http://leafletjs.com/examples/layers-control/)). Extends `Control`.
 *
 * @example
 *
 * ```js
 * var baseLayers = {
 * 	"Mapbox": mapbox,
 * 	"OpenStreetMap": osm
 * };
 *
 * var overlays = {
 * 	"Marker": marker,
 * 	"Roads": roadsLayer
 * };
 *
 * L.control.layers(baseLayers, overlays).addTo(map);
 * ```
 *
 * The `baseLayers` and `overlays` parameters are object literals with layer names as keys and `Layer` objects as values:
 *
 * ```js
 * {
 *     "<someName1>": layer1,
 *     "<someName2>": layer2
 * }
 * ```
 *
 * The layer names can contain HTML, which allows you to add additional styling to the items:
 *
 * ```js
 * {"<img src='my-layer-icon' /> <span class='my-layer-item'>My Layer</span>": myLayer}
 * ```
 */

var Layers = Control.extend({
	// @section
	// @aka Control.Layers options
	options: {
		// @option collapsed: Boolean = true
		// If `true`, the control will be collapsed into an icon and expanded on mouse hover or touch.
		collapsed: true,
		position: 'topright',

		// @option autoZIndex: Boolean = true
		// If `true`, the control will assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off.
		autoZIndex: true,

		// @option hideSingleBase: Boolean = false
		// If `true`, the base layers in the control will be hidden when there is only one.
		hideSingleBase: false,

		// @option sortLayers: Boolean = false
		// Whether to sort the layers. When `false`, layers will keep the order
		// in which they were added to the control.
		sortLayers: false,

		// @option sortFunction: Function = *
		// A [compare function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
		// that will be used for sorting the layers, when `sortLayers` is `true`.
		// The function receives both the `L.Layer` instances and their names, as in
		// `sortFunction(layerA, layerB, nameA, nameB)`.
		// By default, it sorts layers alphabetically by their name.
		sortFunction: function (layerA, layerB, nameA, nameB) {
			return nameA < nameB ? -1 : (nameB < nameA ? 1 : 0);
		}
	},

	initialize: function (baseLayers, overlays, options) {
		setOptions(this, options);

		this._layerControlInputs = [];
		this._layers = [];
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this._addLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
	},

	onAdd: function (map) {
		this._initLayout();
		this._update();

		this._map = map;
		map.on('zoomend', this._checkDisabledLayers, this);

		for (var i = 0; i < this._layers.length; i++) {
			this._layers[i].layer.on('add remove', this._onLayerChange, this);
		}

		return this._container;
	},

	addTo: function (map) {
		Control.prototype.addTo.call(this, map);
		// Trigger expand after Layers Control has been inserted into DOM so that is now has an actual height.
		return this._expandIfNotCollapsed();
	},

	onRemove: function () {
		this._map.off('zoomend', this._checkDisabledLayers, this);

		for (var i = 0; i < this._layers.length; i++) {
			this._layers[i].layer.off('add remove', this._onLayerChange, this);
		}
	},

	// @method addBaseLayer(layer: Layer, name: String): this
	// Adds a base layer (radio button entry) with the given name to the control.
	addBaseLayer: function (layer, name) {
		this._addLayer(layer, name);
		return (this._map) ? this._update() : this;
	},

	// @method addOverlay(layer: Layer, name: String): this
	// Adds an overlay (checkbox entry) with the given name to the control.
	addOverlay: function (layer, name) {
		this._addLayer(layer, name, true);
		return (this._map) ? this._update() : this;
	},

	// @method removeLayer(layer: Layer): this
	// Remove the given layer from the control.
	removeLayer: function (layer) {
		layer.off('add remove', this._onLayerChange, this);

		var obj = this._getLayer(stamp(layer));
		if (obj) {
			this._layers.splice(this._layers.indexOf(obj), 1);
		}
		return (this._map) ? this._update() : this;
	},

	// @method expand(): this
	// Expand the control container if collapsed.
	expand: function () {
		addClass(this._container, 'leaflet-control-layers-expanded');
		this._section.style.height = null;
		var acceptableHeight = this._map.getSize().y - (this._container.offsetTop + 50);
		if (acceptableHeight < this._section.clientHeight) {
			addClass(this._section, 'leaflet-control-layers-scrollbar');
			this._section.style.height = acceptableHeight + 'px';
		} else {
			removeClass(this._section, 'leaflet-control-layers-scrollbar');
		}
		this._checkDisabledLayers();
		return this;
	},

	// @method collapse(): this
	// Collapse the control container if expanded.
	collapse: function () {
		removeClass(this._container, 'leaflet-control-layers-expanded');
		return this;
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		    container = this._container = create$1('div', className),
		    collapsed = this.options.collapsed;

		// makes this work on IE touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		disableClickPropagation(container);
		disableScrollPropagation(container);

		var section = this._section = create$1('section', className + '-list');

		if (collapsed) {
			this._map.on('click', this.collapse, this);

			if (!android) {
				on(container, {
					mouseenter: this.expand,
					mouseleave: this.collapse
				}, this);
			}
		}

		var link = this._layersLink = create$1('a', className + '-toggle', container);
		link.href = '#';
		link.title = 'Layers';

		if (touch) {
			on(link, 'click', stop);
			on(link, 'click', this.expand, this);
		} else {
			on(link, 'focus', this.expand, this);
		}

		if (!collapsed) {
			this.expand();
		}

		this._baseLayersList = create$1('div', className + '-base', section);
		this._separator = create$1('div', className + '-separator', section);
		this._overlaysList = create$1('div', className + '-overlays', section);

		container.appendChild(section);
	},

	_getLayer: function (id) {
		for (var i = 0; i < this._layers.length; i++) {

			if (this._layers[i] && stamp(this._layers[i].layer) === id) {
				return this._layers[i];
			}
		}
	},

	_addLayer: function (layer, name, overlay) {
		if (this._map) {
			layer.on('add remove', this._onLayerChange, this);
		}

		this._layers.push({
			layer: layer,
			name: name,
			overlay: overlay
		});

		if (this.options.sortLayers) {
			this._layers.sort(bind(function (a, b) {
				return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
			}, this));
		}

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}

		this._expandIfNotCollapsed();
	},

	_update: function () {
		if (!this._container) { return this; }

		empty(this._baseLayersList);
		empty(this._overlaysList);

		this._layerControlInputs = [];
		var baseLayersPresent, overlaysPresent, i, obj, baseLayersCount = 0;

		for (i = 0; i < this._layers.length; i++) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
			baseLayersCount += !obj.overlay ? 1 : 0;
		}

		// Hide base layers section if there's only one layer.
		if (this.options.hideSingleBase) {
			baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
			this._baseLayersList.style.display = baseLayersPresent ? '' : 'none';
		}

		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';

		return this;
	},

	_onLayerChange: function (e) {
		if (!this._handlingClick) {
			this._update();
		}

		var obj = this._getLayer(stamp(e.target));

		// @namespace Map
		// @section Layer events
		// @event baselayerchange: LayersControlEvent
		// Fired when the base layer is changed through the [layer control](#control-layers).
		// @event overlayadd: LayersControlEvent
		// Fired when an overlay is selected through the [layer control](#control-layers).
		// @event overlayremove: LayersControlEvent
		// Fired when an overlay is deselected through the [layer control](#control-layers).
		// @namespace Control.Layers
		var type = obj.overlay ?
			(e.type === 'add' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'add' ? 'baselayerchange' : null);

		if (type) {
			this._map.fire(type, obj);
		}
	},

	// IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
	_createRadioElement: function (name, checked) {

		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' +
				name + '"' + (checked ? ' checked="checked"' : '') + '/>';

		var radioFragment = document.createElement('div');
		radioFragment.innerHTML = radioHtml;

		return radioFragment.firstChild;
	},

	_addItem: function (obj) {
		var label = document.createElement('label'),
		    checked = this._map.hasLayer(obj.layer),
		    input;

		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'leaflet-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			input = this._createRadioElement('leaflet-base-layers_' + stamp(this), checked);
		}

		this._layerControlInputs.push(input);
		input.layerId = stamp(obj.layer);

		on(input, 'click', this._onInputClick, this);

		var name = document.createElement('span');
		name.innerHTML = ' ' + obj.name;

		// Helps from preventing layer control flicker when checkboxes are disabled
		// https://github.com/Leaflet/Leaflet/issues/2771
		var holder = document.createElement('div');

		label.appendChild(holder);
		holder.appendChild(input);
		holder.appendChild(name);

		var container = obj.overlay ? this._overlaysList : this._baseLayersList;
		container.appendChild(label);

		this._checkDisabledLayers();
		return label;
	},

	_onInputClick: function () {
		var inputs = this._layerControlInputs,
		    input, layer;
		var addedLayers = [],
		    removedLayers = [];

		this._handlingClick = true;

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._getLayer(input.layerId).layer;

			if (input.checked) {
				addedLayers.push(layer);
			} else if (!input.checked) {
				removedLayers.push(layer);
			}
		}

		// Bugfix issue 2318: Should remove all old layers before readding new ones
		for (i = 0; i < removedLayers.length; i++) {
			if (this._map.hasLayer(removedLayers[i])) {
				this._map.removeLayer(removedLayers[i]);
			}
		}
		for (i = 0; i < addedLayers.length; i++) {
			if (!this._map.hasLayer(addedLayers[i])) {
				this._map.addLayer(addedLayers[i]);
			}
		}

		this._handlingClick = false;

		this._refocusOnMap();
	},

	_checkDisabledLayers: function () {
		var inputs = this._layerControlInputs,
		    input,
		    layer,
		    zoom = this._map.getZoom();

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._getLayer(input.layerId).layer;
			input.disabled = (layer.options.minZoom !== undefined && zoom < layer.options.minZoom) ||
			                 (layer.options.maxZoom !== undefined && zoom > layer.options.maxZoom);

		}
	},

	_expandIfNotCollapsed: function () {
		if (this._map && !this.options.collapsed) {
			this.expand();
		}
		return this;
	},

	_expand: function () {
		// Backward compatibility, remove me in 1.1.
		return this.expand();
	},

	_collapse: function () {
		// Backward compatibility, remove me in 1.1.
		return this.collapse();
	}

});


// @factory L.control.layers(baselayers?: Object, overlays?: Object, options?: Control.Layers options)
// Creates an attribution control with the given layers. Base layers will be switched with radio buttons, while overlays will be switched with checkboxes. Note that all base layers should be passed in the base layers object, but only one should be added to the map during map instantiation.
var layers = function (baseLayers, overlays, options) {
	return new Layers(baseLayers, overlays, options);
};

/*
 * @class Control.Zoom
 * @aka L.Control.Zoom
 * @inherits Control
 *
 * A basic zoom control with two buttons (zoom in and zoom out). It is put on the map by default unless you set its [`zoomControl` option](#map-zoomcontrol) to `false`. Extends `Control`.
 */

var Zoom = Control.extend({
	// @section
	// @aka Control.Zoom options
	options: {
		position: 'topleft',

		// @option zoomInText: String = '+'
		// The text set on the 'zoom in' button.
		zoomInText: '+',

		// @option zoomInTitle: String = 'Zoom in'
		// The title set on the 'zoom in' button.
		zoomInTitle: 'Zoom in',

		// @option zoomOutText: String = '&#x2212;'
		// The text set on the 'zoom out' button.
		zoomOutText: '&#x2212;',

		// @option zoomOutTitle: String = 'Zoom out'
		// The title set on the 'zoom out' button.
		zoomOutTitle: 'Zoom out'
	},

	onAdd: function (map) {
		var zoomName = 'leaflet-control-zoom',
		    container = create$1('div', zoomName + ' leaflet-bar'),
		    options = this.options;

		this._zoomInButton  = this._createButton(options.zoomInText, options.zoomInTitle,
		        zoomName + '-in',  container, this._zoomIn);
		this._zoomOutButton = this._createButton(options.zoomOutText, options.zoomOutTitle,
		        zoomName + '-out', container, this._zoomOut);

		this._updateDisabled();
		map.on('zoomend zoomlevelschange', this._updateDisabled, this);

		return container;
	},

	onRemove: function (map) {
		map.off('zoomend zoomlevelschange', this._updateDisabled, this);
	},

	disable: function () {
		this._disabled = true;
		this._updateDisabled();
		return this;
	},

	enable: function () {
		this._disabled = false;
		this._updateDisabled();
		return this;
	},

	_zoomIn: function (e) {
		if (!this._disabled && this._map._zoom < this._map.getMaxZoom()) {
			this._map.zoomIn(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
		}
	},

	_zoomOut: function (e) {
		if (!this._disabled && this._map._zoom > this._map.getMinZoom()) {
			this._map.zoomOut(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
		}
	},

	_createButton: function (html, title, className, container, fn) {
		var link = create$1('a', className, container);
		link.innerHTML = html;
		link.href = '#';
		link.title = title;

		/*
		 * Will force screen readers like VoiceOver to read this as "Zoom in - button"
		 */
		link.setAttribute('role', 'button');
		link.setAttribute('aria-label', title);

		disableClickPropagation(link);
		on(link, 'click', stop);
		on(link, 'click', fn, this);
		on(link, 'click', this._refocusOnMap, this);

		return link;
	},

	_updateDisabled: function () {
		var map = this._map,
		    className = 'leaflet-disabled';

		removeClass(this._zoomInButton, className);
		removeClass(this._zoomOutButton, className);

		if (this._disabled || map._zoom === map.getMinZoom()) {
			addClass(this._zoomOutButton, className);
		}
		if (this._disabled || map._zoom === map.getMaxZoom()) {
			addClass(this._zoomInButton, className);
		}
	}
});

// @namespace Map
// @section Control options
// @option zoomControl: Boolean = true
// Whether a [zoom control](#control-zoom) is added to the map by default.
Map.mergeOptions({
	zoomControl: true
});

Map.addInitHook(function () {
	if (this.options.zoomControl) {
		// @section Controls
		// @property zoomControl: Control.Zoom
		// The default zoom control (only available if the
		// [`zoomControl` option](#map-zoomcontrol) was `true` when creating the map).
		this.zoomControl = new Zoom();
		this.addControl(this.zoomControl);
	}
});

// @namespace Control.Zoom
// @factory L.control.zoom(options: Control.Zoom options)
// Creates a zoom control
var zoom = function (options) {
	return new Zoom(options);
};

/*
 * @class Control.Scale
 * @aka L.Control.Scale
 * @inherits Control
 *
 * A simple scale control that shows the scale of the current center of screen in metric (m/km) and imperial (mi/ft) systems. Extends `Control`.
 *
 * @example
 *
 * ```js
 * L.control.scale().addTo(map);
 * ```
 */

var Scale = Control.extend({
	// @section
	// @aka Control.Scale options
	options: {
		position: 'bottomleft',

		// @option maxWidth: Number = 100
		// Maximum width of the control in pixels. The width is set dynamically to show round values (e.g. 100, 200, 500).
		maxWidth: 100,

		// @option metric: Boolean = True
		// Whether to show the metric scale line (m/km).
		metric: true,

		// @option imperial: Boolean = True
		// Whether to show the imperial scale line (mi/ft).
		imperial: true

		// @option updateWhenIdle: Boolean = false
		// If `true`, the control is updated on [`moveend`](#map-moveend), otherwise it's always up-to-date (updated on [`move`](#map-move)).
	},

	onAdd: function (map) {
		var className = 'leaflet-control-scale',
		    container = create$1('div', className),
		    options = this.options;

		this._addScales(options, className + '-line', container);

		map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
		map.whenReady(this._update, this);

		return container;
	},

	onRemove: function (map) {
		map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
	},

	_addScales: function (options, className, container) {
		if (options.metric) {
			this._mScale = create$1('div', className, container);
		}
		if (options.imperial) {
			this._iScale = create$1('div', className, container);
		}
	},

	_update: function () {
		var map = this._map,
		    y = map.getSize().y / 2;

		var maxMeters = map.distance(
			map.containerPointToLatLng([0, y]),
			map.containerPointToLatLng([this.options.maxWidth, y]));

		this._updateScales(maxMeters);
	},

	_updateScales: function (maxMeters) {
		if (this.options.metric && maxMeters) {
			this._updateMetric(maxMeters);
		}
		if (this.options.imperial && maxMeters) {
			this._updateImperial(maxMeters);
		}
	},

	_updateMetric: function (maxMeters) {
		var meters = this._getRoundNum(maxMeters),
		    label = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';

		this._updateScale(this._mScale, label, meters / maxMeters);
	},

	_updateImperial: function (maxMeters) {
		var maxFeet = maxMeters * 3.2808399,
		    maxMiles, miles, feet;

		if (maxFeet > 5280) {
			maxMiles = maxFeet / 5280;
			miles = this._getRoundNum(maxMiles);
			this._updateScale(this._iScale, miles + ' mi', miles / maxMiles);

		} else {
			feet = this._getRoundNum(maxFeet);
			this._updateScale(this._iScale, feet + ' ft', feet / maxFeet);
		}
	},

	_updateScale: function (scale, text, ratio) {
		scale.style.width = Math.round(this.options.maxWidth * ratio) + 'px';
		scale.innerHTML = text;
	},

	_getRoundNum: function (num) {
		var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
		    d = num / pow10;

		d = d >= 10 ? 10 :
		    d >= 5 ? 5 :
		    d >= 3 ? 3 :
		    d >= 2 ? 2 : 1;

		return pow10 * d;
	}
});


// @factory L.control.scale(options?: Control.Scale options)
// Creates an scale control with the given options.
var scale = function (options) {
	return new Scale(options);
};

/*
 * @class Control.Attribution
 * @aka L.Control.Attribution
 * @inherits Control
 *
 * The attribution control allows you to display attribution data in a small text box on a map. It is put on the map by default unless you set its [`attributionControl` option](#map-attributioncontrol) to `false`, and it fetches attribution texts from layers with the [`getAttribution` method](#layer-getattribution) automatically. Extends Control.
 */

var Attribution = Control.extend({
	// @section
	// @aka Control.Attribution options
	options: {
		position: 'bottomright',

		// @option prefix: String = 'Leaflet'
		// The HTML text shown before the attributions. Pass `false` to disable.
		prefix: '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>'
	},

	initialize: function (options) {
		setOptions(this, options);

		this._attributions = {};
	},

	onAdd: function (map) {
		map.attributionControl = this;
		this._container = create$1('div', 'leaflet-control-attribution');
		disableClickPropagation(this._container);

		// TODO ugly, refactor
		for (var i in map._layers) {
			if (map._layers[i].getAttribution) {
				this.addAttribution(map._layers[i].getAttribution());
			}
		}

		this._update();

		return this._container;
	},

	// @method setPrefix(prefix: String): this
	// Sets the text before the attributions.
	setPrefix: function (prefix) {
		this.options.prefix = prefix;
		this._update();
		return this;
	},

	// @method addAttribution(text: String): this
	// Adds an attribution text (e.g. `'Vector data &copy; Mapbox'`).
	addAttribution: function (text) {
		if (!text) { return this; }

		if (!this._attributions[text]) {
			this._attributions[text] = 0;
		}
		this._attributions[text]++;

		this._update();

		return this;
	},

	// @method removeAttribution(text: String): this
	// Removes an attribution text.
	removeAttribution: function (text) {
		if (!text) { return this; }

		if (this._attributions[text]) {
			this._attributions[text]--;
			this._update();
		}

		return this;
	},

	_update: function () {
		if (!this._map) { return; }

		var attribs = [];

		for (var i in this._attributions) {
			if (this._attributions[i]) {
				attribs.push(i);
			}
		}

		var prefixAndAttribs = [];

		if (this.options.prefix) {
			prefixAndAttribs.push(this.options.prefix);
		}
		if (attribs.length) {
			prefixAndAttribs.push(attribs.join(', '));
		}

		this._container.innerHTML = prefixAndAttribs.join(' | ');
	}
});

// @namespace Map
// @section Control options
// @option attributionControl: Boolean = true
// Whether a [attribution control](#control-attribution) is added to the map by default.
Map.mergeOptions({
	attributionControl: true
});

Map.addInitHook(function () {
	if (this.options.attributionControl) {
		new Attribution().addTo(this);
	}
});

// @namespace Control.Attribution
// @factory L.control.attribution(options: Control.Attribution options)
// Creates an attribution control.
var attribution = function (options) {
	return new Attribution(options);
};

Control.Layers = Layers;
Control.Zoom = Zoom;
Control.Scale = Scale;
Control.Attribution = Attribution;

control.layers = layers;
control.zoom = zoom;
control.scale = scale;
control.attribution = attribution;

/*
	L.Handler is a base class for handler classes that are used internally to inject
	interaction features like dragging to classes like Map and Marker.
*/

// @class Handler
// @aka L.Handler
// Abstract class for map interaction handlers

var Handler = Class.extend({
	initialize: function (map) {
		this._map = map;
	},

	// @method enable(): this
	// Enables the handler
	enable: function () {
		if (this._enabled) { return this; }

		this._enabled = true;
		this.addHooks();
		return this;
	},

	// @method disable(): this
	// Disables the handler
	disable: function () {
		if (!this._enabled) { return this; }

		this._enabled = false;
		this.removeHooks();
		return this;
	},

	// @method enabled(): Boolean
	// Returns `true` if the handler is enabled
	enabled: function () {
		return !!this._enabled;
	}

	// @section Extension methods
	// Classes inheriting from `Handler` must implement the two following methods:
	// @method addHooks()
	// Called when the handler is enabled, should add event hooks.
	// @method removeHooks()
	// Called when the handler is disabled, should remove the event hooks added previously.
});

// @section There is static function which can be called without instantiating L.Handler:
// @function addTo(map: Map, name: String): this
// Adds a new Handler to the given map with the given name.
Handler.addTo = function (map, name) {
	map.addHandler(name, this);
	return this;
};

var Mixin = {Events: Events};

/*
 * @class Draggable
 * @aka L.Draggable
 * @inherits Evented
 *
 * A class for making DOM elements draggable (including touch support).
 * Used internally for map and marker dragging. Only works for elements
 * that were positioned with [`L.DomUtil.setPosition`](#domutil-setposition).
 *
 * @example
 * ```js
 * var draggable = new L.Draggable(elementToDrag);
 * draggable.enable();
 * ```
 */

var START = touch ? 'touchstart mousedown' : 'mousedown';
var END = {
	mousedown: 'mouseup',
	touchstart: 'touchend',
	pointerdown: 'touchend',
	MSPointerDown: 'touchend'
};
var MOVE = {
	mousedown: 'mousemove',
	touchstart: 'touchmove',
	pointerdown: 'touchmove',
	MSPointerDown: 'touchmove'
};


var Draggable = Evented.extend({

	options: {
		// @section
		// @aka Draggable options
		// @option clickTolerance: Number = 3
		// The max number of pixels a user can shift the mouse pointer during a click
		// for it to be considered a valid click (as opposed to a mouse drag).
		clickTolerance: 3
	},

	// @constructor L.Draggable(el: HTMLElement, dragHandle?: HTMLElement, preventOutline?: Boolean, options?: Draggable options)
	// Creates a `Draggable` object for moving `el` when you start dragging the `dragHandle` element (equals `el` itself by default).
	initialize: function (element, dragStartTarget, preventOutline$$1, options) {
		setOptions(this, options);

		this._element = element;
		this._dragStartTarget = dragStartTarget || element;
		this._preventOutline = preventOutline$$1;
	},

	// @method enable()
	// Enables the dragging ability
	enable: function () {
		if (this._enabled) { return; }

		on(this._dragStartTarget, START, this._onDown, this);

		this._enabled = true;
	},

	// @method disable()
	// Disables the dragging ability
	disable: function () {
		if (!this._enabled) { return; }

		// If we're currently dragging this draggable,
		// disabling it counts as first ending the drag.
		if (Draggable._dragging === this) {
			this.finishDrag();
		}

		off(this._dragStartTarget, START, this._onDown, this);

		this._enabled = false;
		this._moved = false;
	},

	_onDown: function (e) {
		// Ignore simulated events, since we handle both touch and
		// mouse explicitly; otherwise we risk getting duplicates of
		// touch events, see #4315.
		// Also ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (e._simulated || !this._enabled) { return; }

		this._moved = false;

		if (hasClass(this._element, 'leaflet-zoom-anim')) { return; }

		if (Draggable._dragging || e.shiftKey || ((e.which !== 1) && (e.button !== 1) && !e.touches)) { return; }
		Draggable._dragging = this;  // Prevent dragging multiple objects at once.

		if (this._preventOutline) {
			preventOutline(this._element);
		}

		disableImageDrag();
		disableTextSelection();

		if (this._moving) { return; }

		// @event down: Event
		// Fired when a drag is about to start.
		this.fire('down');

		var first = e.touches ? e.touches[0] : e,
		    sizedParent = getSizedParentNode(this._element);

		this._startPoint = new Point(first.clientX, first.clientY);

		// Cache the scale, so that we can continuously compensate for it during drag (_onMove).
		this._parentScale = getScale(sizedParent);

		on(document, MOVE[e.type], this._onMove, this);
		on(document, END[e.type], this._onUp, this);
	},

	_onMove: function (e) {
		// Ignore simulated events, since we handle both touch and
		// mouse explicitly; otherwise we risk getting duplicates of
		// touch events, see #4315.
		// Also ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (e._simulated || !this._enabled) { return; }

		if (e.touches && e.touches.length > 1) {
			this._moved = true;
			return;
		}

		var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
		    offset = new Point(first.clientX, first.clientY)._subtract(this._startPoint);

		if (!offset.x && !offset.y) { return; }
		if (Math.abs(offset.x) + Math.abs(offset.y) < this.options.clickTolerance) { return; }

		// We assume that the parent container's position, border and scale do not change for the duration of the drag.
		// Therefore there is no need to account for the position and border (they are eliminated by the subtraction)
		// and we can use the cached value for the scale.
		offset.x /= this._parentScale.x;
		offset.y /= this._parentScale.y;

		preventDefault(e);

		if (!this._moved) {
			// @event dragstart: Event
			// Fired when a drag starts
			this.fire('dragstart');

			this._moved = true;
			this._startPos = getPosition(this._element).subtract(offset);

			addClass(document.body, 'leaflet-dragging');

			this._lastTarget = e.target || e.srcElement;
			// IE and Edge do not give the <use> element, so fetch it
			// if necessary
			if ((window.SVGElementInstance) && (this._lastTarget instanceof SVGElementInstance)) {
				this._lastTarget = this._lastTarget.correspondingUseElement;
			}
			addClass(this._lastTarget, 'leaflet-drag-target');
		}

		this._newPos = this._startPos.add(offset);
		this._moving = true;

		cancelAnimFrame(this._animRequest);
		this._lastEvent = e;
		this._animRequest = requestAnimFrame(this._updatePosition, this, true);
	},

	_updatePosition: function () {
		var e = {originalEvent: this._lastEvent};

		// @event predrag: Event
		// Fired continuously during dragging *before* each corresponding
		// update of the element's position.
		this.fire('predrag', e);
		setPosition(this._element, this._newPos);

		// @event drag: Event
		// Fired continuously during dragging.
		this.fire('drag', e);
	},

	_onUp: function (e) {
		// Ignore simulated events, since we handle both touch and
		// mouse explicitly; otherwise we risk getting duplicates of
		// touch events, see #4315.
		// Also ignore the event if disabled; this happens in IE11
		// under some circumstances, see #3666.
		if (e._simulated || !this._enabled) { return; }
		this.finishDrag();
	},

	finishDrag: function () {
		removeClass(document.body, 'leaflet-dragging');

		if (this._lastTarget) {
			removeClass(this._lastTarget, 'leaflet-drag-target');
			this._lastTarget = null;
		}

		for (var i in MOVE) {
			off(document, MOVE[i], this._onMove, this);
			off(document, END[i], this._onUp, this);
		}

		enableImageDrag();
		enableTextSelection();

		if (this._moved && this._moving) {
			// ensure drag is not fired after dragend
			cancelAnimFrame(this._animRequest);

			// @event dragend: DragEndEvent
			// Fired when the drag ends.
			this.fire('dragend', {
				distance: this._newPos.distanceTo(this._startPos)
			});
		}

		this._moving = false;
		Draggable._dragging = false;
	}

});

/*
 * @namespace LineUtil
 *
 * Various utility functions for polyline points processing, used by Leaflet internally to make polylines lightning-fast.
 */

// Simplify polyline with vertex reduction and Douglas-Peucker simplification.
// Improves rendering performance dramatically by lessening the number of points to draw.

// @function simplify(points: Point[], tolerance: Number): Point[]
// Dramatically reduces the number of points in a polyline while retaining
// its shape and returns a new array of simplified points, using the
// [Douglas-Peucker algorithm](http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm).
// Used for a huge performance boost when processing/displaying Leaflet polylines for
// each zoom level and also reducing visual noise. tolerance affects the amount of
// simplification (lesser value means higher quality but slower and with more points).
// Also released as a separated micro-library [Simplify.js](http://mourner.github.com/simplify-js/).
function simplify(points, tolerance) {
	if (!tolerance || !points.length) {
		return points.slice();
	}

	var sqTolerance = tolerance * tolerance;

	    // stage 1: vertex reduction
	    points = _reducePoints(points, sqTolerance);

	    // stage 2: Douglas-Peucker simplification
	    points = _simplifyDP(points, sqTolerance);

	return points;
}

// @function pointToSegmentDistance(p: Point, p1: Point, p2: Point): Number
// Returns the distance between point `p` and segment `p1` to `p2`.
function pointToSegmentDistance(p, p1, p2) {
	return Math.sqrt(_sqClosestPointOnSegment(p, p1, p2, true));
}

// @function closestPointOnSegment(p: Point, p1: Point, p2: Point): Number
// Returns the closest point from a point `p` on a segment `p1` to `p2`.
function closestPointOnSegment(p, p1, p2) {
	return _sqClosestPointOnSegment(p, p1, p2);
}

// Douglas-Peucker simplification, see http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm
function _simplifyDP(points, sqTolerance) {

	var len = points.length,
	    ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
	    markers = new ArrayConstructor(len);

	    markers[0] = markers[len - 1] = 1;

	_simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

	var i,
	    newPoints = [];

	for (i = 0; i < len; i++) {
		if (markers[i]) {
			newPoints.push(points[i]);
		}
	}

	return newPoints;
}

function _simplifyDPStep(points, markers, sqTolerance, first, last) {

	var maxSqDist = 0,
	index, i, sqDist;

	for (i = first + 1; i <= last - 1; i++) {
		sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);

		if (sqDist > maxSqDist) {
			index = i;
			maxSqDist = sqDist;
		}
	}

	if (maxSqDist > sqTolerance) {
		markers[index] = 1;

		_simplifyDPStep(points, markers, sqTolerance, first, index);
		_simplifyDPStep(points, markers, sqTolerance, index, last);
	}
}

// reduce points that are too close to each other to a single point
function _reducePoints(points, sqTolerance) {
	var reducedPoints = [points[0]];

	for (var i = 1, prev = 0, len = points.length; i < len; i++) {
		if (_sqDist(points[i], points[prev]) > sqTolerance) {
			reducedPoints.push(points[i]);
			prev = i;
		}
	}
	if (prev < len - 1) {
		reducedPoints.push(points[len - 1]);
	}
	return reducedPoints;
}

var _lastCode;

// @function clipSegment(a: Point, b: Point, bounds: Bounds, useLastCode?: Boolean, round?: Boolean): Point[]|Boolean
// Clips the segment a to b by rectangular bounds with the
// [Cohen-Sutherland algorithm](https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm)
// (modifying the segment points directly!). Used by Leaflet to only show polyline
// points that are on the screen or near, increasing performance.
function clipSegment(a, b, bounds, useLastCode, round) {
	var codeA = useLastCode ? _lastCode : _getBitCode(a, bounds),
	    codeB = _getBitCode(b, bounds),

	    codeOut, p, newCode;

	    // save 2nd code to avoid calculating it on the next segment
	    _lastCode = codeB;

	while (true) {
		// if a,b is inside the clip window (trivial accept)
		if (!(codeA | codeB)) {
			return [a, b];
		}

		// if a,b is outside the clip window (trivial reject)
		if (codeA & codeB) {
			return false;
		}

		// other cases
		codeOut = codeA || codeB;
		p = _getEdgeIntersection(a, b, codeOut, bounds, round);
		newCode = _getBitCode(p, bounds);

		if (codeOut === codeA) {
			a = p;
			codeA = newCode;
		} else {
			b = p;
			codeB = newCode;
		}
	}
}

function _getEdgeIntersection(a, b, code, bounds, round) {
	var dx = b.x - a.x,
	    dy = b.y - a.y,
	    min = bounds.min,
	    max = bounds.max,
	    x, y;

	if (code & 8) { // top
		x = a.x + dx * (max.y - a.y) / dy;
		y = max.y;

	} else if (code & 4) { // bottom
		x = a.x + dx * (min.y - a.y) / dy;
		y = min.y;

	} else if (code & 2) { // right
		x = max.x;
		y = a.y + dy * (max.x - a.x) / dx;

	} else if (code & 1) { // left
		x = min.x;
		y = a.y + dy * (min.x - a.x) / dx;
	}

	return new Point(x, y, round);
}

function _getBitCode(p, bounds) {
	var code = 0;

	if (p.x < bounds.min.x) { // left
		code |= 1;
	} else if (p.x > bounds.max.x) { // right
		code |= 2;
	}

	if (p.y < bounds.min.y) { // bottom
		code |= 4;
	} else if (p.y > bounds.max.y) { // top
		code |= 8;
	}

	return code;
}

// square distance (to avoid unnecessary Math.sqrt calls)
function _sqDist(p1, p2) {
	var dx = p2.x - p1.x,
	    dy = p2.y - p1.y;
	return dx * dx + dy * dy;
}

// return closest point on segment or distance to that point
function _sqClosestPointOnSegment(p, p1, p2, sqDist) {
	var x = p1.x,
	    y = p1.y,
	    dx = p2.x - x,
	    dy = p2.y - y,
	    dot = dx * dx + dy * dy,
	    t;

	if (dot > 0) {
		t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

		if (t > 1) {
			x = p2.x;
			y = p2.y;
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}

	dx = p.x - x;
	dy = p.y - y;

	return sqDist ? dx * dx + dy * dy : new Point(x, y);
}


// @function isFlat(latlngs: LatLng[]): Boolean
// Returns true if `latlngs` is a flat array, false is nested.
function isFlat(latlngs) {
	return !isArray(latlngs[0]) || (typeof latlngs[0][0] !== 'object' && typeof latlngs[0][0] !== 'undefined');
}

function _flat(latlngs) {
	console.warn('Deprecated use of _flat, please use L.LineUtil.isFlat instead.');
	return isFlat(latlngs);
}


var LineUtil = (Object.freeze || Object)({
	simplify: simplify,
	pointToSegmentDistance: pointToSegmentDistance,
	closestPointOnSegment: closestPointOnSegment,
	clipSegment: clipSegment,
	_getEdgeIntersection: _getEdgeIntersection,
	_getBitCode: _getBitCode,
	_sqClosestPointOnSegment: _sqClosestPointOnSegment,
	isFlat: isFlat,
	_flat: _flat
});

/*
 * @namespace PolyUtil
 * Various utility functions for polygon geometries.
 */

/* @function clipPolygon(points: Point[], bounds: Bounds, round?: Boolean): Point[]
 * Clips the polygon geometry defined by the given `points` by the given bounds (using the [Sutherland-Hodgman algorithm](https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm)).
 * Used by Leaflet to only show polygon points that are on the screen or near, increasing
 * performance. Note that polygon points needs different algorithm for clipping
 * than polyline, so there's a separate method for it.
 */
function clipPolygon(points, bounds, round) {
	var clippedPoints,
	    edges = [1, 4, 2, 8],
	    i, j, k,
	    a, b,
	    len, edge, p;

	for (i = 0, len = points.length; i < len; i++) {
		points[i]._code = _getBitCode(points[i], bounds);
	}

	// for each edge (left, bottom, right, top)
	for (k = 0; k < 4; k++) {
		edge = edges[k];
		clippedPoints = [];

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			a = points[i];
			b = points[j];

			// if a is inside the clip window
			if (!(a._code & edge)) {
				// if b is outside the clip window (a->b goes out of screen)
				if (b._code & edge) {
					p = _getEdgeIntersection(b, a, edge, bounds, round);
					p._code = _getBitCode(p, bounds);
					clippedPoints.push(p);
				}
				clippedPoints.push(a);

			// else if b is inside the clip window (a->b enters the screen)
			} else if (!(b._code & edge)) {
				p = _getEdgeIntersection(b, a, edge, bounds, round);
				p._code = _getBitCode(p, bounds);
				clippedPoints.push(p);
			}
		}
		points = clippedPoints;
	}

	return points;
}


var PolyUtil = (Object.freeze || Object)({
	clipPolygon: clipPolygon
});

/*
 * @namespace Projection
 * @section
 * Leaflet comes with a set of already defined Projections out of the box:
 *
 * @projection L.Projection.LonLat
 *
 * Equirectangular, or Plate Carree projection — the most simple projection,
 * mostly used by GIS enthusiasts. Directly maps `x` as longitude, and `y` as
 * latitude. Also suitable for flat worlds, e.g. game maps. Used by the
 * `EPSG:4326` and `Simple` CRS.
 */

var LonLat = {
	project: function (latlng) {
		return new Point(latlng.lng, latlng.lat);
	},

	unproject: function (point) {
		return new LatLng(point.y, point.x);
	},

	bounds: new Bounds([-180, -90], [180, 90])
};

/*
 * @namespace Projection
 * @projection L.Projection.Mercator
 *
 * Elliptical Mercator projection — more complex than Spherical Mercator. Assumes that Earth is an ellipsoid. Used by the EPSG:3395 CRS.
 */

var Mercator = {
	R: 6378137,
	R_MINOR: 6356752.314245179,

	bounds: new Bounds([-20037508.34279, -15496570.73972], [20037508.34279, 18764656.23138]),

	project: function (latlng) {
		var d = Math.PI / 180,
		    r = this.R,
		    y = latlng.lat * d,
		    tmp = this.R_MINOR / r,
		    e = Math.sqrt(1 - tmp * tmp),
		    con = e * Math.sin(y);

		var ts = Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);
		y = -r * Math.log(Math.max(ts, 1E-10));

		return new Point(latlng.lng * d * r, y);
	},

	unproject: function (point) {
		var d = 180 / Math.PI,
		    r = this.R,
		    tmp = this.R_MINOR / r,
		    e = Math.sqrt(1 - tmp * tmp),
		    ts = Math.exp(-point.y / r),
		    phi = Math.PI / 2 - 2 * Math.atan(ts);

		for (var i = 0, dphi = 0.1, con; i < 15 && Math.abs(dphi) > 1e-7; i++) {
			con = e * Math.sin(phi);
			con = Math.pow((1 - con) / (1 + con), e / 2);
			dphi = Math.PI / 2 - 2 * Math.atan(ts * con) - phi;
			phi += dphi;
		}

		return new LatLng(phi * d, point.x * d / r);
	}
};

/*
 * @class Projection

 * An object with methods for projecting geographical coordinates of the world onto
 * a flat surface (and back). See [Map projection](http://en.wikipedia.org/wiki/Map_projection).

 * @property bounds: Bounds
 * The bounds (specified in CRS units) where the projection is valid

 * @method project(latlng: LatLng): Point
 * Projects geographical coordinates into a 2D point.
 * Only accepts actual `L.LatLng` instances, not arrays.

 * @method unproject(point: Point): LatLng
 * The inverse of `project`. Projects a 2D point into a geographical location.
 * Only accepts actual `L.Point` instances, not arrays.

 * Note that the projection instances do not inherit from Leafet's `Class` object,
 * and can't be instantiated. Also, new classes can't inherit from them,
 * and methods can't be added to them with the `include` function.

 */




var index = (Object.freeze || Object)({
	LonLat: LonLat,
	Mercator: Mercator,
	SphericalMercator: SphericalMercator
});

/*
 * @namespace CRS
 * @crs L.CRS.EPSG3395
 *
 * Rarely used by some commercial tile providers. Uses Elliptical Mercator projection.
 */
var EPSG3395 = extend({}, Earth, {
	code: 'EPSG:3395',
	projection: Mercator,

	transformation: (function () {
		var scale = 0.5 / (Math.PI * Mercator.R);
		return toTransformation(scale, 0.5, -scale, 0.5);
	}())
});

/*
 * @namespace CRS
 * @crs L.CRS.EPSG4326
 *
 * A common CRS among GIS enthusiasts. Uses simple Equirectangular projection.
 *
 * Leaflet 1.0.x complies with the [TMS coordinate scheme for EPSG:4326](https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification#global-geodetic),
 * which is a breaking change from 0.7.x behaviour.  If you are using a `TileLayer`
 * with this CRS, ensure that there are two 256x256 pixel tiles covering the
 * whole earth at zoom level zero, and that the tile coordinate origin is (-180,+90),
 * or (-180,-90) for `TileLayer`s with [the `tms` option](#tilelayer-tms) set.
 */

var EPSG4326 = extend({}, Earth, {
	code: 'EPSG:4326',
	projection: LonLat,
	transformation: toTransformation(1 / 180, 1, -1 / 180, 0.5)
});

/*
 * @namespace CRS
 * @crs L.CRS.Simple
 *
 * A simple CRS that maps longitude and latitude into `x` and `y` directly.
 * May be used for maps of flat surfaces (e.g. game maps). Note that the `y`
 * axis should still be inverted (going from bottom to top). `distance()` returns
 * simple euclidean distance.
 */

var Simple = extend({}, CRS, {
	projection: LonLat,
	transformation: toTransformation(1, 0, -1, 0),

	scale: function (zoom) {
		return Math.pow(2, zoom);
	},

	zoom: function (scale) {
		return Math.log(scale) / Math.LN2;
	},

	distance: function (latlng1, latlng2) {
		var dx = latlng2.lng - latlng1.lng,
		    dy = latlng2.lat - latlng1.lat;

		return Math.sqrt(dx * dx + dy * dy);
	},

	infinite: true
});

CRS.Earth = Earth;
CRS.EPSG3395 = EPSG3395;
CRS.EPSG3857 = EPSG3857;
CRS.EPSG900913 = EPSG900913;
CRS.EPSG4326 = EPSG4326;
CRS.Simple = Simple;

/*
 * @class Layer
 * @inherits Evented
 * @aka L.Layer
 * @aka ILayer
 *
 * A set of methods from the Layer base class that all Leaflet layers use.
 * Inherits all methods, options and events from `L.Evented`.
 *
 * @example
 *
 * ```js
 * var layer = L.marker(latlng).addTo(map);
 * layer.addTo(map);
 * layer.remove();
 * ```
 *
 * @event add: Event
 * Fired after the layer is added to a map
 *
 * @event remove: Event
 * Fired after the layer is removed from a map
 */


var Layer = Evented.extend({

	// Classes extending `L.Layer` will inherit the following options:
	options: {
		// @option pane: String = 'overlayPane'
		// By default the layer will be added to the map's [overlay pane](#map-overlaypane). Overriding this option will cause the layer to be placed on another pane by default.
		pane: 'overlayPane',

		// @option attribution: String = null
		// String to be shown in the attribution control, e.g. "© OpenStreetMap contributors". It describes the layer data and is often a legal obligation towards copyright holders and tile providers.
		attribution: null,

		bubblingMouseEvents: true
	},

	/* @section
	 * Classes extending `L.Layer` will inherit the following methods:
	 *
	 * @method addTo(map: Map|LayerGroup): this
	 * Adds the layer to the given map or layer group.
	 */
	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	// @method remove: this
	// Removes the layer from the map it is currently active on.
	remove: function () {
		return this.removeFrom(this._map || this._mapToAdd);
	},

	// @method removeFrom(map: Map): this
	// Removes the layer from the given map
	removeFrom: function (obj) {
		if (obj) {
			obj.removeLayer(this);
		}
		return this;
	},

	// @method getPane(name? : String): HTMLElement
	// Returns the `HTMLElement` representing the named pane on the map. If `name` is omitted, returns the pane for this layer.
	getPane: function (name) {
		return this._map.getPane(name ? (this.options[name] || name) : this.options.pane);
	},

	addInteractiveTarget: function (targetEl) {
		this._map._targets[stamp(targetEl)] = this;
		return this;
	},

	removeInteractiveTarget: function (targetEl) {
		delete this._map._targets[stamp(targetEl)];
		return this;
	},

	// @method getAttribution: String
	// Used by the `attribution control`, returns the [attribution option](#gridlayer-attribution).
	getAttribution: function () {
		return this.options.attribution;
	},

	_layerAdd: function (e) {
		var map = e.target;

		// check in case layer gets added and then removed before the map is ready
		if (!map.hasLayer(this)) { return; }

		this._map = map;
		this._zoomAnimated = map._zoomAnimated;

		if (this.getEvents) {
			var events = this.getEvents();
			map.on(events, this);
			this.once('remove', function () {
				map.off(events, this);
			}, this);
		}

		this.onAdd(map);

		if (this.getAttribution && map.attributionControl) {
			map.attributionControl.addAttribution(this.getAttribution());
		}

		this.fire('add');
		map.fire('layeradd', {layer: this});
	}
});

/* @section Extension methods
 * @uninheritable
 *
 * Every layer should extend from `L.Layer` and (re-)implement the following methods.
 *
 * @method onAdd(map: Map): this
 * Should contain code that creates DOM elements for the layer, adds them to `map panes` where they should belong and puts listeners on relevant map events. Called on [`map.addLayer(layer)`](#map-addlayer).
 *
 * @method onRemove(map: Map): this
 * Should contain all clean up code that removes the layer's elements from the DOM and removes listeners previously added in [`onAdd`](#layer-onadd). Called on [`map.removeLayer(layer)`](#map-removelayer).
 *
 * @method getEvents(): Object
 * This optional method should return an object like `{ viewreset: this._reset }` for [`addEventListener`](#evented-addeventlistener). The event handlers in this object will be automatically added and removed from the map with your layer.
 *
 * @method getAttribution(): String
 * This optional method should return a string containing HTML to be shown on the `Attribution control` whenever the layer is visible.
 *
 * @method beforeAdd(map: Map): this
 * Optional method. Called on [`map.addLayer(layer)`](#map-addlayer), before the layer is added to the map, before events are initialized, without waiting until the map is in a usable state. Use for early initialization only.
 */


/* @namespace Map
 * @section Layer events
 *
 * @event layeradd: LayerEvent
 * Fired when a new layer is added to the map.
 *
 * @event layerremove: LayerEvent
 * Fired when some layer is removed from the map
 *
 * @section Methods for Layers and Controls
 */
Map.include({
	// @method addLayer(layer: Layer): this
	// Adds the given layer to the map
	addLayer: function (layer) {
		if (!layer._layerAdd) {
			throw new Error('The provided object is not a Layer.');
		}

		var id = stamp(layer);
		if (this._layers[id]) { return this; }
		this._layers[id] = layer;

		layer._mapToAdd = this;

		if (layer.beforeAdd) {
			layer.beforeAdd(this);
		}

		this.whenReady(layer._layerAdd, layer);

		return this;
	},

	// @method removeLayer(layer: Layer): this
	// Removes the given layer from the map.
	removeLayer: function (layer) {
		var id = stamp(layer);

		if (!this._layers[id]) { return this; }

		if (this._loaded) {
			layer.onRemove(this);
		}

		if (layer.getAttribution && this.attributionControl) {
			this.attributionControl.removeAttribution(layer.getAttribution());
		}

		delete this._layers[id];

		if (this._loaded) {
			this.fire('layerremove', {layer: layer});
			layer.fire('remove');
		}

		layer._map = layer._mapToAdd = null;

		return this;
	},

	// @method hasLayer(layer: Layer): Boolean
	// Returns `true` if the given layer is currently added to the map
	hasLayer: function (layer) {
		return !!layer && (stamp(layer) in this._layers);
	},

	/* @method eachLayer(fn: Function, context?: Object): this
	 * Iterates over the layers of the map, optionally specifying context of the iterator function.
	 * ```
	 * map.eachLayer(function(layer){
	 *     layer.bindPopup('Hello');
	 * });
	 * ```
	 */
	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	_addLayers: function (layers) {
		layers = layers ? (isArray(layers) ? layers : [layers]) : [];

		for (var i = 0, len = layers.length; i < len; i++) {
			this.addLayer(layers[i]);
		}
	},

	_addZoomLimit: function (layer) {
		if (isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
			this._zoomBoundLayers[stamp(layer)] = layer;
			this._updateZoomLevels();
		}
	},

	_removeZoomLimit: function (layer) {
		var id = stamp(layer);

		if (this._zoomBoundLayers[id]) {
			delete this._zoomBoundLayers[id];
			this._updateZoomLevels();
		}
	},

	_updateZoomLevels: function () {
		var minZoom = Infinity,
		    maxZoom = -Infinity,
		    oldZoomSpan = this._getZoomSpan();

		for (var i in this._zoomBoundLayers) {
			var options = this._zoomBoundLayers[i].options;

			minZoom = options.minZoom === undefined ? minZoom : Math.min(minZoom, options.minZoom);
			maxZoom = options.maxZoom === undefined ? maxZoom : Math.max(maxZoom, options.maxZoom);
		}

		this._layersMaxZoom = maxZoom === -Infinity ? undefined : maxZoom;
		this._layersMinZoom = minZoom === Infinity ? undefined : minZoom;

		// @section Map state change events
		// @event zoomlevelschange: Event
		// Fired when the number of zoomlevels on the map is changed due
		// to adding or removing a layer.
		if (oldZoomSpan !== this._getZoomSpan()) {
			this.fire('zoomlevelschange');
		}

		if (this.options.maxZoom === undefined && this._layersMaxZoom && this.getZoom() > this._layersMaxZoom) {
			this.setZoom(this._layersMaxZoom);
		}
		if (this.options.minZoom === undefined && this._layersMinZoom && this.getZoom() < this._layersMinZoom) {
			this.setZoom(this._layersMinZoom);
		}
	}
});

/*
 * @class LayerGroup
 * @aka L.LayerGroup
 * @inherits Layer
 *
 * Used to group several layers and handle them as one. If you add it to the map,
 * any layers added or removed from the group will be added/removed on the map as
 * well. Extends `Layer`.
 *
 * @example
 *
 * ```js
 * L.layerGroup([marker1, marker2])
 * 	.addLayer(polyline)
 * 	.addTo(map);
 * ```
 */

var LayerGroup = Layer.extend({

	initialize: function (layers, options) {
		setOptions(this, options);

		this._layers = {};

		var i, len;

		if (layers) {
			for (i = 0, len = layers.length; i < len; i++) {
				this.addLayer(layers[i]);
			}
		}
	},

	// @method addLayer(layer: Layer): this
	// Adds the given layer to the group.
	addLayer: function (layer) {
		var id = this.getLayerId(layer);

		this._layers[id] = layer;

		if (this._map) {
			this._map.addLayer(layer);
		}

		return this;
	},

	// @method removeLayer(layer: Layer): this
	// Removes the given layer from the group.
	// @alternative
	// @method removeLayer(id: Number): this
	// Removes the layer with the given internal ID from the group.
	removeLayer: function (layer) {
		var id = layer in this._layers ? layer : this.getLayerId(layer);

		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}

		delete this._layers[id];

		return this;
	},

	// @method hasLayer(layer: Layer): Boolean
	// Returns `true` if the given layer is currently added to the group.
	// @alternative
	// @method hasLayer(id: Number): Boolean
	// Returns `true` if the given internal ID is currently added to the group.
	hasLayer: function (layer) {
		return !!layer && (layer in this._layers || this.getLayerId(layer) in this._layers);
	},

	// @method clearLayers(): this
	// Removes all the layers from the group.
	clearLayers: function () {
		return this.eachLayer(this.removeLayer, this);
	},

	// @method invoke(methodName: String, …): this
	// Calls `methodName` on every layer contained in this group, passing any
	// additional parameters. Has no effect if the layers contained do not
	// implement `methodName`.
	invoke: function (methodName) {
		var args = Array.prototype.slice.call(arguments, 1),
		    i, layer;

		for (i in this._layers) {
			layer = this._layers[i];

			if (layer[methodName]) {
				layer[methodName].apply(layer, args);
			}
		}

		return this;
	},

	onAdd: function (map) {
		this.eachLayer(map.addLayer, map);
	},

	onRemove: function (map) {
		this.eachLayer(map.removeLayer, map);
	},

	// @method eachLayer(fn: Function, context?: Object): this
	// Iterates over the layers of the group, optionally specifying context of the iterator function.
	// ```js
	// group.eachLayer(function (layer) {
	// 	layer.bindPopup('Hello');
	// });
	// ```
	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	// @method getLayer(id: Number): Layer
	// Returns the layer with the given internal ID.
	getLayer: function (id) {
		return this._layers[id];
	},

	// @method getLayers(): Layer[]
	// Returns an array of all the layers added to the group.
	getLayers: function () {
		var layers = [];
		this.eachLayer(layers.push, layers);
		return layers;
	},

	// @method setZIndex(zIndex: Number): this
	// Calls `setZIndex` on every layer contained in this group, passing the z-index.
	setZIndex: function (zIndex) {
		return this.invoke('setZIndex', zIndex);
	},

	// @method getLayerId(layer: Layer): Number
	// Returns the internal ID for a layer
	getLayerId: function (layer) {
		return stamp(layer);
	}
});


// @factory L.layerGroup(layers?: Layer[], options?: Object)
// Create a layer group, optionally given an initial set of layers and an `options` object.
var layerGroup = function (layers, options) {
	return new LayerGroup(layers, options);
};

/*
 * @class FeatureGroup
 * @aka L.FeatureGroup
 * @inherits LayerGroup
 *
 * Extended `LayerGroup` that makes it easier to do the same thing to all its member layers:
 *  * [`bindPopup`](#layer-bindpopup) binds a popup to all of the layers at once (likewise with [`bindTooltip`](#layer-bindtooltip))
 *  * Events are propagated to the `FeatureGroup`, so if the group has an event
 * handler, it will handle events from any of the layers. This includes mouse events
 * and custom events.
 *  * Has `layeradd` and `layerremove` events
 *
 * @example
 *
 * ```js
 * L.featureGroup([marker1, marker2, polyline])
 * 	.bindPopup('Hello world!')
 * 	.on('click', function() { alert('Clicked on a member of the group!'); })
 * 	.addTo(map);
 * ```
 */

var FeatureGroup = LayerGroup.extend({

	addLayer: function (layer) {
		if (this.hasLayer(layer)) {
			return this;
		}

		layer.addEventParent(this);

		LayerGroup.prototype.addLayer.call(this, layer);

		// @event layeradd: LayerEvent
		// Fired when a layer is added to this `FeatureGroup`
		return this.fire('layeradd', {layer: layer});
	},

	removeLayer: function (layer) {
		if (!this.hasLayer(layer)) {
			return this;
		}
		if (layer in this._layers) {
			layer = this._layers[layer];
		}

		layer.removeEventParent(this);

		LayerGroup.prototype.removeLayer.call(this, layer);

		// @event layerremove: LayerEvent
		// Fired when a layer is removed from this `FeatureGroup`
		return this.fire('layerremove', {layer: layer});
	},

	// @method setStyle(style: Path options): this
	// Sets the given path options to each layer of the group that has a `setStyle` method.
	setStyle: function (style) {
		return this.invoke('setStyle', style);
	},

	// @method bringToFront(): this
	// Brings the layer group to the top of all other layers
	bringToFront: function () {
		return this.invoke('bringToFront');
	},

	// @method bringToBack(): this
	// Brings the layer group to the back of all other layers
	bringToBack: function () {
		return this.invoke('bringToBack');
	},

	// @method getBounds(): LatLngBounds
	// Returns the LatLngBounds of the Feature Group (created from bounds and coordinates of its children).
	getBounds: function () {
		var bounds = new LatLngBounds();

		for (var id in this._layers) {
			var layer = this._layers[id];
			bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
		}
		return bounds;
	}
});

// @factory L.featureGroup(layers: Layer[])
// Create a feature group, optionally given an initial set of layers.
var featureGroup = function (layers) {
	return new FeatureGroup(layers);
};

/*
 * @class Icon
 * @aka L.Icon
 *
 * Represents an icon to provide when creating a marker.
 *
 * @example
 *
 * ```js
 * var myIcon = L.icon({
 *     iconUrl: 'my-icon.png',
 *     iconRetinaUrl: 'my-icon@2x.png',
 *     iconSize: [38, 95],
 *     iconAnchor: [22, 94],
 *     popupAnchor: [-3, -76],
 *     shadowUrl: 'my-icon-shadow.png',
 *     shadowRetinaUrl: 'my-icon-shadow@2x.png',
 *     shadowSize: [68, 95],
 *     shadowAnchor: [22, 94]
 * });
 *
 * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * `L.Icon.Default` extends `L.Icon` and is the blue icon Leaflet uses for markers by default.
 *
 */

var Icon = Class.extend({

	/* @section
	 * @aka Icon options
	 *
	 * @option iconUrl: String = null
	 * **(required)** The URL to the icon image (absolute or relative to your script path).
	 *
	 * @option iconRetinaUrl: String = null
	 * The URL to a retina sized version of the icon image (absolute or relative to your
	 * script path). Used for Retina screen devices.
	 *
	 * @option iconSize: Point = null
	 * Size of the icon image in pixels.
	 *
	 * @option iconAnchor: Point = null
	 * The coordinates of the "tip" of the icon (relative to its top left corner). The icon
	 * will be aligned so that this point is at the marker's geographical location. Centered
	 * by default if size is specified, also can be set in CSS with negative margins.
	 *
	 * @option popupAnchor: Point = [0, 0]
	 * The coordinates of the point from which popups will "open", relative to the icon anchor.
	 *
	 * @option tooltipAnchor: Point = [0, 0]
	 * The coordinates of the point from which tooltips will "open", relative to the icon anchor.
	 *
	 * @option shadowUrl: String = null
	 * The URL to the icon shadow image. If not specified, no shadow image will be created.
	 *
	 * @option shadowRetinaUrl: String = null
	 *
	 * @option shadowSize: Point = null
	 * Size of the shadow image in pixels.
	 *
	 * @option shadowAnchor: Point = null
	 * The coordinates of the "tip" of the shadow (relative to its top left corner) (the same
	 * as iconAnchor if not specified).
	 *
	 * @option className: String = ''
	 * A custom class name to assign to both icon and shadow images. Empty by default.
	 */

	options: {
		popupAnchor: [0, 0],
		tooltipAnchor: [0, 0]
	},

	initialize: function (options) {
		setOptions(this, options);
	},

	// @method createIcon(oldIcon?: HTMLElement): HTMLElement
	// Called internally when the icon has to be shown, returns a `<img>` HTML element
	// styled according to the options.
	createIcon: function (oldIcon) {
		return this._createIcon('icon', oldIcon);
	},

	// @method createShadow(oldIcon?: HTMLElement): HTMLElement
	// As `createIcon`, but for the shadow beneath it.
	createShadow: function (oldIcon) {
		return this._createIcon('shadow', oldIcon);
	},

	_createIcon: function (name, oldIcon) {
		var src = this._getIconUrl(name);

		if (!src) {
			if (name === 'icon') {
				throw new Error('iconUrl not set in Icon options (see the docs).');
			}
			return null;
		}

		var img = this._createImg(src, oldIcon && oldIcon.tagName === 'IMG' ? oldIcon : null);
		this._setIconStyles(img, name);

		return img;
	},

	_setIconStyles: function (img, name) {
		var options = this.options;
		var sizeOption = options[name + 'Size'];

		if (typeof sizeOption === 'number') {
			sizeOption = [sizeOption, sizeOption];
		}

		var size = toPoint(sizeOption),
		    anchor = toPoint(name === 'shadow' && options.shadowAnchor || options.iconAnchor ||
		            size && size.divideBy(2, true));

		img.className = 'leaflet-marker-' + name + ' ' + (options.className || '');

		if (anchor) {
			img.style.marginLeft = (-anchor.x) + 'px';
			img.style.marginTop  = (-anchor.y) + 'px';
		}

		if (size) {
			img.style.width  = size.x + 'px';
			img.style.height = size.y + 'px';
		}
	},

	_createImg: function (src, el) {
		el = el || document.createElement('img');
		el.src = src;
		return el;
	},

	_getIconUrl: function (name) {
		return retina && this.options[name + 'RetinaUrl'] || this.options[name + 'Url'];
	}
});


// @factory L.icon(options: Icon options)
// Creates an icon instance with the given options.
function icon(options) {
	return new Icon(options);
}

/*
 * @miniclass Icon.Default (Icon)
 * @aka L.Icon.Default
 * @section
 *
 * A trivial subclass of `Icon`, represents the icon to use in `Marker`s when
 * no icon is specified. Points to the blue marker image distributed with Leaflet
 * releases.
 *
 * In order to customize the default icon, just change the properties of `L.Icon.Default.prototype.options`
 * (which is a set of `Icon options`).
 *
 * If you want to _completely_ replace the default icon, override the
 * `L.Marker.prototype.options.icon` with your own icon instead.
 */

var IconDefault = Icon.extend({

	options: {
		iconUrl:       'marker-icon.png',
		iconRetinaUrl: 'marker-icon-2x.png',
		shadowUrl:     'marker-shadow.png',
		iconSize:    [25, 41],
		iconAnchor:  [12, 41],
		popupAnchor: [1, -34],
		tooltipAnchor: [16, -28],
		shadowSize:  [41, 41]
	},

	_getIconUrl: function (name) {
		if (!IconDefault.imagePath) {	// Deprecated, backwards-compatibility only
			IconDefault.imagePath = this._detectIconPath();
		}

		// @option imagePath: String
		// `Icon.Default` will try to auto-detect the location of the
		// blue icon images. If you are placing these images in a non-standard
		// way, set this option to point to the right path.
		return (this.options.imagePath || IconDefault.imagePath) + Icon.prototype._getIconUrl.call(this, name);
	},

	_detectIconPath: function () {
		var el = create$1('div',  'leaflet-default-icon-path', document.body);
		var path = getStyle(el, 'background-image') ||
		           getStyle(el, 'backgroundImage');	// IE8

		document.body.removeChild(el);

		if (path === null || path.indexOf('url') !== 0) {
			path = '';
		} else {
			path = path.replace(/^url\(["']?/, '').replace(/marker-icon\.png["']?\)$/, '');
		}

		return path;
	}
});

/*
 * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
 */


/* @namespace Marker
 * @section Interaction handlers
 *
 * Interaction handlers are properties of a marker instance that allow you to control interaction behavior in runtime, enabling or disabling certain features such as dragging (see `Handler` methods). Example:
 *
 * ```js
 * marker.dragging.disable();
 * ```
 *
 * @property dragging: Handler
 * Marker dragging handler (by both mouse and touch). Only valid when the marker is on the map (Otherwise set [`marker.options.draggable`](#marker-draggable)).
 */

var MarkerDrag = Handler.extend({
	initialize: function (marker) {
		this._marker = marker;
	},

	addHooks: function () {
		var icon = this._marker._icon;

		if (!this._draggable) {
			this._draggable = new Draggable(icon, icon, true);
		}

		this._draggable.on({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).enable();

		addClass(icon, 'leaflet-marker-draggable');
	},

	removeHooks: function () {
		this._draggable.off({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).disable();

		if (this._marker._icon) {
			removeClass(this._marker._icon, 'leaflet-marker-draggable');
		}
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_adjustPan: function (e) {
		var marker = this._marker,
		    map = marker._map,
		    speed = this._marker.options.autoPanSpeed,
		    padding = this._marker.options.autoPanPadding,
		    iconPos = getPosition(marker._icon),
		    bounds = map.getPixelBounds(),
		    origin = map.getPixelOrigin();

		var panBounds = toBounds(
			bounds.min._subtract(origin).add(padding),
			bounds.max._subtract(origin).subtract(padding)
		);

		if (!panBounds.contains(iconPos)) {
			// Compute incremental movement
			var movement = toPoint(
				(Math.max(panBounds.max.x, iconPos.x) - panBounds.max.x) / (bounds.max.x - panBounds.max.x) -
				(Math.min(panBounds.min.x, iconPos.x) - panBounds.min.x) / (bounds.min.x - panBounds.min.x),

				(Math.max(panBounds.max.y, iconPos.y) - panBounds.max.y) / (bounds.max.y - panBounds.max.y) -
				(Math.min(panBounds.min.y, iconPos.y) - panBounds.min.y) / (bounds.min.y - panBounds.min.y)
			).multiplyBy(speed);

			map.panBy(movement, {animate: false});

			this._draggable._newPos._add(movement);
			this._draggable._startPos._add(movement);

			setPosition(marker._icon, this._draggable._newPos);
			this._onDrag(e);

			this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
		}
	},

	_onDragStart: function () {
		// @section Dragging events
		// @event dragstart: Event
		// Fired when the user starts dragging the marker.

		// @event movestart: Event
		// Fired when the marker starts moving (because of dragging).

		this._oldLatLng = this._marker.getLatLng();
		this._marker
		    .closePopup()
		    .fire('movestart')
		    .fire('dragstart');
	},

	_onPreDrag: function (e) {
		if (this._marker.options.autoPan) {
			cancelAnimFrame(this._panRequest);
			this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
		}
	},

	_onDrag: function (e) {
		var marker = this._marker,
		    shadow = marker._shadow,
		    iconPos = getPosition(marker._icon),
		    latlng = marker._map.layerPointToLatLng(iconPos);

		// update shadow position
		if (shadow) {
			setPosition(shadow, iconPos);
		}

		marker._latlng = latlng;
		e.latlng = latlng;
		e.oldLatLng = this._oldLatLng;

		// @event drag: Event
		// Fired repeatedly while the user drags the marker.
		marker
		    .fire('move', e)
		    .fire('drag', e);
	},

	_onDragEnd: function (e) {
		// @event dragend: DragEndEvent
		// Fired when the user stops dragging the marker.

		 cancelAnimFrame(this._panRequest);

		// @event moveend: Event
		// Fired when the marker stops moving (because of dragging).
		delete this._oldLatLng;
		this._marker
		    .fire('moveend')
		    .fire('dragend', e);
	}
});

/*
 * @class Marker
 * @inherits Interactive layer
 * @aka L.Marker
 * L.Marker is used to display clickable/draggable icons on the map. Extends `Layer`.
 *
 * @example
 *
 * ```js
 * L.marker([50.5, 30.5]).addTo(map);
 * ```
 */

var Marker = Layer.extend({

	// @section
	// @aka Marker options
	options: {
		// @option icon: Icon = *
		// Icon instance to use for rendering the marker.
		// See [Icon documentation](#L.Icon) for details on how to customize the marker icon.
		// If not specified, a common instance of `L.Icon.Default` is used.
		icon: new IconDefault(),

		// Option inherited from "Interactive layer" abstract class
		interactive: true,

		// @option keyboard: Boolean = true
		// Whether the marker can be tabbed to with a keyboard and clicked by pressing enter.
		keyboard: true,

		// @option title: String = ''
		// Text for the browser tooltip that appear on marker hover (no tooltip by default).
		title: '',

		// @option alt: String = ''
		// Text for the `alt` attribute of the icon image (useful for accessibility).
		alt: '',

		// @option zIndexOffset: Number = 0
		// By default, marker images zIndex is set automatically based on its latitude. Use this option if you want to put the marker on top of all others (or below), specifying a high value like `1000` (or high negative value, respectively).
		zIndexOffset: 0,

		// @option opacity: Number = 1.0
		// The opacity of the marker.
		opacity: 1,

		// @option riseOnHover: Boolean = false
		// If `true`, the marker will get on top of others when you hover the mouse over it.
		riseOnHover: false,

		// @option riseOffset: Number = 250
		// The z-index offset used for the `riseOnHover` feature.
		riseOffset: 250,

		// @option pane: String = 'markerPane'
		// `Map pane` where the markers icon will be added.
		pane: 'markerPane',

		// @option pane: String = 'shadowPane'
		// `Map pane` where the markers shadow will be added.
		shadowPane: 'shadowPane',

		// @option bubblingMouseEvents: Boolean = false
		// When `true`, a mouse event on this marker will trigger the same event on the map
		// (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
		bubblingMouseEvents: false,

		// @section Draggable marker options
		// @option draggable: Boolean = false
		// Whether the marker is draggable with mouse/touch or not.
		draggable: false,

		// @option autoPan: Boolean = false
		// Whether to pan the map when dragging this marker near its edge or not.
		autoPan: false,

		// @option autoPanPadding: Point = Point(50, 50)
		// Distance (in pixels to the left/right and to the top/bottom) of the
		// map edge to start panning the map.
		autoPanPadding: [50, 50],

		// @option autoPanSpeed: Number = 10
		// Number of pixels the map should pan by.
		autoPanSpeed: 10
	},

	/* @section
	 *
	 * In addition to [shared layer methods](#Layer) like `addTo()` and `remove()` and [popup methods](#Popup) like bindPopup() you can also use the following methods:
	 */

	initialize: function (latlng, options) {
		setOptions(this, options);
		this._latlng = toLatLng(latlng);
	},

	onAdd: function (map) {
		this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;

		if (this._zoomAnimated) {
			map.on('zoomanim', this._animateZoom, this);
		}

		this._initIcon();
		this.update();
	},

	onRemove: function (map) {
		if (this.dragging && this.dragging.enabled()) {
			this.options.draggable = true;
			this.dragging.removeHooks();
		}
		delete this.dragging;

		if (this._zoomAnimated) {
			map.off('zoomanim', this._animateZoom, this);
		}

		this._removeIcon();
		this._removeShadow();
	},

	getEvents: function () {
		return {
			zoom: this.update,
			viewreset: this.update
		};
	},

	// @method getLatLng: LatLng
	// Returns the current geographical position of the marker.
	getLatLng: function () {
		return this._latlng;
	},

	// @method setLatLng(latlng: LatLng): this
	// Changes the marker position to the given point.
	setLatLng: function (latlng) {
		var oldLatLng = this._latlng;
		this._latlng = toLatLng(latlng);
		this.update();

		// @event move: Event
		// Fired when the marker is moved via [`setLatLng`](#marker-setlatlng) or by [dragging](#marker-dragging). Old and new coordinates are included in event arguments as `oldLatLng`, `latlng`.
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	// @method setZIndexOffset(offset: Number): this
	// Changes the [zIndex offset](#marker-zindexoffset) of the marker.
	setZIndexOffset: function (offset) {
		this.options.zIndexOffset = offset;
		return this.update();
	},

	// @method getIcon: Icon
	// Returns the current icon used by the marker
	getIcon: function () {
		return this.options.icon;
	},

	// @method setIcon(icon: Icon): this
	// Changes the marker icon.
	setIcon: function (icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		if (this._popup) {
			this.bindPopup(this._popup, this._popup.options);
		}

		return this;
	},

	getElement: function () {
		return this._icon;
	},

	update: function () {

		if (this._icon && this._map) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}

		return this;
	},

	_initIcon: function () {
		var options = this.options,
		    classToAdd = 'leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

		var icon = options.icon.createIcon(this._icon),
		    addIcon = false;

		// if we're not reusing the icon, remove the old one and init new one
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}

			if (icon.tagName === 'IMG') {
				icon.alt = options.alt || '';
			}
		}

		addClass(icon, classToAdd);

		if (options.keyboard) {
			icon.tabIndex = '0';
		}

		this._icon = icon;

		if (options.riseOnHover) {
			this.on({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		var newShadow = options.icon.createShadow(this._shadow),
		    addShadow = false;

		if (newShadow !== this._shadow) {
			this._removeShadow();
			addShadow = true;
		}

		if (newShadow) {
			addClass(newShadow, classToAdd);
			newShadow.alt = '';
		}
		this._shadow = newShadow;


		if (options.opacity < 1) {
			this._updateOpacity();
		}


		if (addIcon) {
			this.getPane().appendChild(this._icon);
		}
		this._initInteraction();
		if (newShadow && addShadow) {
			this.getPane(options.shadowPane).appendChild(this._shadow);
		}
	},

	_removeIcon: function () {
		if (this.options.riseOnHover) {
			this.off({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		remove(this._icon);
		this.removeInteractiveTarget(this._icon);

		this._icon = null;
	},

	_removeShadow: function () {
		if (this._shadow) {
			remove(this._shadow);
		}
		this._shadow = null;
	},

	_setPos: function (pos) {
		setPosition(this._icon, pos);

		if (this._shadow) {
			setPosition(this._shadow, pos);
		}

		this._zIndex = pos.y + this.options.zIndexOffset;

		this._resetZIndex();
	},

	_updateZIndex: function (offset) {
		this._icon.style.zIndex = this._zIndex + offset;
	},

	_animateZoom: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

		this._setPos(pos);
	},

	_initInteraction: function () {

		if (!this.options.interactive) { return; }

		addClass(this._icon, 'leaflet-interactive');

		this.addInteractiveTarget(this._icon);

		if (MarkerDrag) {
			var draggable = this.options.draggable;
			if (this.dragging) {
				draggable = this.dragging.enabled();
				this.dragging.disable();
			}

			this.dragging = new MarkerDrag(this);

			if (draggable) {
				this.dragging.enable();
			}
		}
	},

	// @method setOpacity(opacity: Number): this
	// Changes the opacity of the marker.
	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;

		if (this._icon) {
			setOpacity(this._icon, opacity);
		}

		if (this._shadow) {
			setOpacity(this._shadow, opacity);
		}
	},

	_bringToFront: function () {
		this._updateZIndex(this.options.riseOffset);
	},

	_resetZIndex: function () {
		this._updateZIndex(0);
	},

	_getPopupAnchor: function () {
		return this.options.icon.options.popupAnchor;
	},

	_getTooltipAnchor: function () {
		return this.options.icon.options.tooltipAnchor;
	}
});


// factory L.marker(latlng: LatLng, options? : Marker options)

// @factory L.marker(latlng: LatLng, options? : Marker options)
// Instantiates a Marker object given a geographical point and optionally an options object.
function marker(latlng, options) {
	return new Marker(latlng, options);
}

/*
 * @class Path
 * @aka L.Path
 * @inherits Interactive layer
 *
 * An abstract class that contains options and constants shared between vector
 * overlays (Polygon, Polyline, Circle). Do not use it directly. Extends `Layer`.
 */

var Path = Layer.extend({

	// @section
	// @aka Path options
	options: {
		// @option stroke: Boolean = true
		// Whether to draw stroke along the path. Set it to `false` to disable borders on polygons or circles.
		stroke: true,

		// @option color: String = '#3388ff'
		// Stroke color
		color: '#3388ff',

		// @option weight: Number = 3
		// Stroke width in pixels
		weight: 3,

		// @option opacity: Number = 1.0
		// Stroke opacity
		opacity: 1,

		// @option lineCap: String= 'round'
		// A string that defines [shape to be used at the end](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linecap) of the stroke.
		lineCap: 'round',

		// @option lineJoin: String = 'round'
		// A string that defines [shape to be used at the corners](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linejoin) of the stroke.
		lineJoin: 'round',

		// @option dashArray: String = null
		// A string that defines the stroke [dash pattern](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dasharray). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
		dashArray: null,

		// @option dashOffset: String = null
		// A string that defines the [distance into the dash pattern to start the dash](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dashoffset). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
		dashOffset: null,

		// @option fill: Boolean = depends
		// Whether to fill the path with color. Set it to `false` to disable filling on polygons or circles.
		fill: false,

		// @option fillColor: String = *
		// Fill color. Defaults to the value of the [`color`](#path-color) option
		fillColor: null,

		// @option fillOpacity: Number = 0.2
		// Fill opacity.
		fillOpacity: 0.2,

		// @option fillRule: String = 'evenodd'
		// A string that defines [how the inside of a shape](https://developer.mozilla.org/docs/Web/SVG/Attribute/fill-rule) is determined.
		fillRule: 'evenodd',

		// className: '',

		// Option inherited from "Interactive layer" abstract class
		interactive: true,

		// @option bubblingMouseEvents: Boolean = true
		// When `true`, a mouse event on this path will trigger the same event on the map
		// (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
		bubblingMouseEvents: true
	},

	beforeAdd: function (map) {
		// Renderer is set here because we need to call renderer.getEvents
		// before this.getEvents.
		this._renderer = map.getRenderer(this);
	},

	onAdd: function () {
		this._renderer._initPath(this);
		this._reset();
		this._renderer._addPath(this);
	},

	onRemove: function () {
		this._renderer._removePath(this);
	},

	// @method redraw(): this
	// Redraws the layer. Sometimes useful after you changed the coordinates that the path uses.
	redraw: function () {
		if (this._map) {
			this._renderer._updatePath(this);
		}
		return this;
	},

	// @method setStyle(style: Path options): this
	// Changes the appearance of a Path based on the options in the `Path options` object.
	setStyle: function (style) {
		setOptions(this, style);
		if (this._renderer) {
			this._renderer._updateStyle(this);
			if (this.options.stroke && style.hasOwnProperty('weight')) {
				this._updateBounds();
			}
		}
		return this;
	},

	// @method bringToFront(): this
	// Brings the layer to the top of all path layers.
	bringToFront: function () {
		if (this._renderer) {
			this._renderer._bringToFront(this);
		}
		return this;
	},

	// @method bringToBack(): this
	// Brings the layer to the bottom of all path layers.
	bringToBack: function () {
		if (this._renderer) {
			this._renderer._bringToBack(this);
		}
		return this;
	},

	getElement: function () {
		return this._path;
	},

	_reset: function () {
		// defined in child classes
		this._project();
		this._update();
	},

	_clickTolerance: function () {
		// used when doing hit detection for Canvas layers
		return (this.options.stroke ? this.options.weight / 2 : 0) + this._renderer.options.tolerance;
	}
});

/*
 * @class CircleMarker
 * @aka L.CircleMarker
 * @inherits Path
 *
 * A circle of a fixed size with radius specified in pixels. Extends `Path`.
 */

var CircleMarker = Path.extend({

	// @section
	// @aka CircleMarker options
	options: {
		fill: true,

		// @option radius: Number = 10
		// Radius of the circle marker, in pixels
		radius: 10
	},

	initialize: function (latlng, options) {
		setOptions(this, options);
		this._latlng = toLatLng(latlng);
		this._radius = this.options.radius;
	},

	// @method setLatLng(latLng: LatLng): this
	// Sets the position of a circle marker to a new location.
	setLatLng: function (latlng) {
		this._latlng = toLatLng(latlng);
		this.redraw();
		return this.fire('move', {latlng: this._latlng});
	},

	// @method getLatLng(): LatLng
	// Returns the current geographical position of the circle marker
	getLatLng: function () {
		return this._latlng;
	},

	// @method setRadius(radius: Number): this
	// Sets the radius of a circle marker. Units are in pixels.
	setRadius: function (radius) {
		this.options.radius = this._radius = radius;
		return this.redraw();
	},

	// @method getRadius(): Number
	// Returns the current radius of the circle
	getRadius: function () {
		return this._radius;
	},

	setStyle : function (options) {
		var radius = options && options.radius || this._radius;
		Path.prototype.setStyle.call(this, options);
		this.setRadius(radius);
		return this;
	},

	_project: function () {
		this._point = this._map.latLngToLayerPoint(this._latlng);
		this._updateBounds();
	},

	_updateBounds: function () {
		var r = this._radius,
		    r2 = this._radiusY || r,
		    w = this._clickTolerance(),
		    p = [r + w, r2 + w];
		this._pxBounds = new Bounds(this._point.subtract(p), this._point.add(p));
	},

	_update: function () {
		if (this._map) {
			this._updatePath();
		}
	},

	_updatePath: function () {
		this._renderer._updateCircle(this);
	},

	_empty: function () {
		return this._radius && !this._renderer._bounds.intersects(this._pxBounds);
	},

	// Needed by the `Canvas` renderer for interactivity
	_containsPoint: function (p) {
		return p.distanceTo(this._point) <= this._radius + this._clickTolerance();
	}
});


// @factory L.circleMarker(latlng: LatLng, options?: CircleMarker options)
// Instantiates a circle marker object given a geographical point, and an optional options object.
function circleMarker(latlng, options) {
	return new CircleMarker(latlng, options);
}

/*
 * @class Circle
 * @aka L.Circle
 * @inherits CircleMarker
 *
 * A class for drawing circle overlays on a map. Extends `CircleMarker`.
 *
 * It's an approximation and starts to diverge from a real circle closer to poles (due to projection distortion).
 *
 * @example
 *
 * ```js
 * L.circle([50.5, 30.5], {radius: 200}).addTo(map);
 * ```
 */

var Circle = CircleMarker.extend({

	initialize: function (latlng, options, legacyOptions) {
		if (typeof options === 'number') {
			// Backwards compatibility with 0.7.x factory (latlng, radius, options?)
			options = extend({}, legacyOptions, {radius: options});
		}
		setOptions(this, options);
		this._latlng = toLatLng(latlng);

		if (isNaN(this.options.radius)) { throw new Error('Circle radius cannot be NaN'); }

		// @section
		// @aka Circle options
		// @option radius: Number; Radius of the circle, in meters.
		this._mRadius = this.options.radius;
	},

	// @method setRadius(radius: Number): this
	// Sets the radius of a circle. Units are in meters.
	setRadius: function (radius) {
		this._mRadius = radius;
		return this.redraw();
	},

	// @method getRadius(): Number
	// Returns the current radius of a circle. Units are in meters.
	getRadius: function () {
		return this._mRadius;
	},

	// @method getBounds(): LatLngBounds
	// Returns the `LatLngBounds` of the path.
	getBounds: function () {
		var half = [this._radius, this._radiusY || this._radius];

		return new LatLngBounds(
			this._map.layerPointToLatLng(this._point.subtract(half)),
			this._map.layerPointToLatLng(this._point.add(half)));
	},

	setStyle: Path.prototype.setStyle,

	_project: function () {

		var lng = this._latlng.lng,
		    lat = this._latlng.lat,
		    map = this._map,
		    crs = map.options.crs;

		if (crs.distance === Earth.distance) {
			var d = Math.PI / 180,
			    latR = (this._mRadius / Earth.R) / d,
			    top = map.project([lat + latR, lng]),
			    bottom = map.project([lat - latR, lng]),
			    p = top.add(bottom).divideBy(2),
			    lat2 = map.unproject(p).lat,
			    lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) /
			            (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;

			if (isNaN(lngR) || lngR === 0) {
				lngR = latR / Math.cos(Math.PI / 180 * lat); // Fallback for edge case, #2425
			}

			this._point = p.subtract(map.getPixelOrigin());
			this._radius = isNaN(lngR) ? 0 : p.x - map.project([lat2, lng - lngR]).x;
			this._radiusY = p.y - top.y;

		} else {
			var latlng2 = crs.unproject(crs.project(this._latlng).subtract([this._mRadius, 0]));

			this._point = map.latLngToLayerPoint(this._latlng);
			this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;
		}

		this._updateBounds();
	}
});

// @factory L.circle(latlng: LatLng, options?: Circle options)
// Instantiates a circle object given a geographical point, and an options object
// which contains the circle radius.
// @alternative
// @factory L.circle(latlng: LatLng, radius: Number, options?: Circle options)
// Obsolete way of instantiating a circle, for compatibility with 0.7.x code.
// Do not use in new applications or plugins.
function circle(latlng, options, legacyOptions) {
	return new Circle(latlng, options, legacyOptions);
}

/*
 * @class Polyline
 * @aka L.Polyline
 * @inherits Path
 *
 * A class for drawing polyline overlays on a map. Extends `Path`.
 *
 * @example
 *
 * ```js
 * // create a red polyline from an array of LatLng points
 * var latlngs = [
 * 	[45.51, -122.68],
 * 	[37.77, -122.43],
 * 	[34.04, -118.2]
 * ];
 *
 * var polyline = L.polyline(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polyline
 * map.fitBounds(polyline.getBounds());
 * ```
 *
 * You can also pass a multi-dimensional array to represent a `MultiPolyline` shape:
 *
 * ```js
 * // create a red polyline from an array of arrays of LatLng points
 * var latlngs = [
 * 	[[45.51, -122.68],
 * 	 [37.77, -122.43],
 * 	 [34.04, -118.2]],
 * 	[[40.78, -73.91],
 * 	 [41.83, -87.62],
 * 	 [32.76, -96.72]]
 * ];
 * ```
 */


var Polyline = Path.extend({

	// @section
	// @aka Polyline options
	options: {
		// @option smoothFactor: Number = 1.0
		// How much to simplify the polyline on each zoom level. More means
		// better performance and smoother look, and less means more accurate representation.
		smoothFactor: 1.0,

		// @option noClip: Boolean = false
		// Disable polyline clipping.
		noClip: false
	},

	initialize: function (latlngs, options) {
		setOptions(this, options);
		this._setLatLngs(latlngs);
	},

	// @method getLatLngs(): LatLng[]
	// Returns an array of the points in the path, or nested arrays of points in case of multi-polyline.
	getLatLngs: function () {
		return this._latlngs;
	},

	// @method setLatLngs(latlngs: LatLng[]): this
	// Replaces all the points in the polyline with the given array of geographical points.
	setLatLngs: function (latlngs) {
		this._setLatLngs(latlngs);
		return this.redraw();
	},

	// @method isEmpty(): Boolean
	// Returns `true` if the Polyline has no LatLngs.
	isEmpty: function () {
		return !this._latlngs.length;
	},

	// @method closestLayerPoint(p: Point): Point
	// Returns the point closest to `p` on the Polyline.
	closestLayerPoint: function (p) {
		var minDistance = Infinity,
		    minPoint = null,
		    closest = _sqClosestPointOnSegment,
		    p1, p2;

		for (var j = 0, jLen = this._parts.length; j < jLen; j++) {
			var points = this._parts[j];

			for (var i = 1, len = points.length; i < len; i++) {
				p1 = points[i - 1];
				p2 = points[i];

				var sqDist = closest(p, p1, p2, true);

				if (sqDist < minDistance) {
					minDistance = sqDist;
					minPoint = closest(p, p1, p2);
				}
			}
		}
		if (minPoint) {
			minPoint.distance = Math.sqrt(minDistance);
		}
		return minPoint;
	},

	// @method getCenter(): LatLng
	// Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the polyline.
	getCenter: function () {
		// throws error when not yet added to map as this center calculation requires projected coordinates
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}

		var i, halfDist, segDist, dist, p1, p2, ratio,
		    points = this._rings[0],
		    len = points.length;

		if (!len) { return null; }

		// polyline centroid algorithm; only uses the first ring if there are multiple

		for (i = 0, halfDist = 0; i < len - 1; i++) {
			halfDist += points[i].distanceTo(points[i + 1]) / 2;
		}

		// The line is so small in the current view that all points are on the same pixel.
		if (halfDist === 0) {
			return this._map.layerPointToLatLng(points[0]);
		}

		for (i = 0, dist = 0; i < len - 1; i++) {
			p1 = points[i];
			p2 = points[i + 1];
			segDist = p1.distanceTo(p2);
			dist += segDist;

			if (dist > halfDist) {
				ratio = (dist - halfDist) / segDist;
				return this._map.layerPointToLatLng([
					p2.x - ratio * (p2.x - p1.x),
					p2.y - ratio * (p2.y - p1.y)
				]);
			}
		}
	},

	// @method getBounds(): LatLngBounds
	// Returns the `LatLngBounds` of the path.
	getBounds: function () {
		return this._bounds;
	},

	// @method addLatLng(latlng: LatLng, latlngs? LatLng[]): this
	// Adds a given point to the polyline. By default, adds to the first ring of
	// the polyline in case of a multi-polyline, but can be overridden by passing
	// a specific ring as a LatLng array (that you can earlier access with [`getLatLngs`](#polyline-getlatlngs)).
	addLatLng: function (latlng, latlngs) {
		latlngs = latlngs || this._defaultShape();
		latlng = toLatLng(latlng);
		latlngs.push(latlng);
		this._bounds.extend(latlng);
		return this.redraw();
	},

	_setLatLngs: function (latlngs) {
		this._bounds = new LatLngBounds();
		this._latlngs = this._convertLatLngs(latlngs);
	},

	_defaultShape: function () {
		return isFlat(this._latlngs) ? this._latlngs : this._latlngs[0];
	},

	// recursively convert latlngs input into actual LatLng instances; calculate bounds along the way
	_convertLatLngs: function (latlngs) {
		var result = [],
		    flat = isFlat(latlngs);

		for (var i = 0, len = latlngs.length; i < len; i++) {
			if (flat) {
				result[i] = toLatLng(latlngs[i]);
				this._bounds.extend(result[i]);
			} else {
				result[i] = this._convertLatLngs(latlngs[i]);
			}
		}

		return result;
	},

	_project: function () {
		var pxBounds = new Bounds();
		this._rings = [];
		this._projectLatlngs(this._latlngs, this._rings, pxBounds);

		if (this._bounds.isValid() && pxBounds.isValid()) {
			this._rawPxBounds = pxBounds;
			this._updateBounds();
		}
	},

	_updateBounds: function () {
		var w = this._clickTolerance(),
		    p = new Point(w, w);
		this._pxBounds = new Bounds([
			this._rawPxBounds.min.subtract(p),
			this._rawPxBounds.max.add(p)
		]);
	},

	// recursively turns latlngs into a set of rings with projected coordinates
	_projectLatlngs: function (latlngs, result, projectedBounds) {
		var flat = latlngs[0] instanceof LatLng,
		    len = latlngs.length,
		    i, ring;

		if (flat) {
			ring = [];
			for (i = 0; i < len; i++) {
				ring[i] = this._map.latLngToLayerPoint(latlngs[i]);
				projectedBounds.extend(ring[i]);
			}
			result.push(ring);
		} else {
			for (i = 0; i < len; i++) {
				this._projectLatlngs(latlngs[i], result, projectedBounds);
			}
		}
	},

	// clip polyline by renderer bounds so that we have less to render for performance
	_clipPoints: function () {
		var bounds = this._renderer._bounds;

		this._parts = [];
		if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		var parts = this._parts,
		    i, j, k, len, len2, segment, points;

		for (i = 0, k = 0, len = this._rings.length; i < len; i++) {
			points = this._rings[i];

			for (j = 0, len2 = points.length; j < len2 - 1; j++) {
				segment = clipSegment(points[j], points[j + 1], bounds, j, true);

				if (!segment) { continue; }

				parts[k] = parts[k] || [];
				parts[k].push(segment[0]);

				// if segment goes out of screen, or it's the last one, it's the end of the line part
				if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
					parts[k].push(segment[1]);
					k++;
				}
			}
		}
	},

	// simplify each clipped part of the polyline for performance
	_simplifyPoints: function () {
		var parts = this._parts,
		    tolerance = this.options.smoothFactor;

		for (var i = 0, len = parts.length; i < len; i++) {
			parts[i] = simplify(parts[i], tolerance);
		}
	},

	_update: function () {
		if (!this._map) { return; }

		this._clipPoints();
		this._simplifyPoints();
		this._updatePath();
	},

	_updatePath: function () {
		this._renderer._updatePoly(this);
	},

	// Needed by the `Canvas` renderer for interactivity
	_containsPoint: function (p, closed) {
		var i, j, k, len, len2, part,
		    w = this._clickTolerance();

		if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

		// hit detection for polylines
		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				if (!closed && (j === 0)) { continue; }

				if (pointToSegmentDistance(p, part[k], part[j]) <= w) {
					return true;
				}
			}
		}
		return false;
	}
});

// @factory L.polyline(latlngs: LatLng[], options?: Polyline options)
// Instantiates a polyline object given an array of geographical points and
// optionally an options object. You can create a `Polyline` object with
// multiple separate lines (`MultiPolyline`) by passing an array of arrays
// of geographic points.
function polyline(latlngs, options) {
	return new Polyline(latlngs, options);
}

// Retrocompat. Allow plugins to support Leaflet versions before and after 1.1.
Polyline._flat = _flat;

/*
 * @class Polygon
 * @aka L.Polygon
 * @inherits Polyline
 *
 * A class for drawing polygon overlays on a map. Extends `Polyline`.
 *
 * Note that points you pass when creating a polygon shouldn't have an additional last point equal to the first one — it's better to filter out such points.
 *
 *
 * @example
 *
 * ```js
 * // create a red polygon from an array of LatLng points
 * var latlngs = [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]];
 *
 * var polygon = L.polygon(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polygon
 * map.fitBounds(polygon.getBounds());
 * ```
 *
 * You can also pass an array of arrays of latlngs, with the first array representing the outer shape and the other arrays representing holes in the outer shape:
 *
 * ```js
 * var latlngs = [
 *   [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *   [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 * ];
 * ```
 *
 * Additionally, you can pass a multi-dimensional array to represent a MultiPolygon shape.
 *
 * ```js
 * var latlngs = [
 *   [ // first polygon
 *     [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *     [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 *   ],
 *   [ // second polygon
 *     [[41, -111.03],[45, -111.04],[45, -104.05],[41, -104.05]]
 *   ]
 * ];
 * ```
 */

var Polygon = Polyline.extend({

	options: {
		fill: true
	},

	isEmpty: function () {
		return !this._latlngs.length || !this._latlngs[0].length;
	},

	getCenter: function () {
		// throws error when not yet added to map as this center calculation requires projected coordinates
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}

		var i, j, p1, p2, f, area, x, y, center,
		    points = this._rings[0],
		    len = points.length;

		if (!len) { return null; }

		// polygon centroid algorithm; only uses the first ring if there are multiple

		area = x = y = 0;

		for (i = 0, j = len - 1; i < len; j = i++) {
			p1 = points[i];
			p2 = points[j];

			f = p1.y * p2.x - p2.y * p1.x;
			x += (p1.x + p2.x) * f;
			y += (p1.y + p2.y) * f;
			area += f * 3;
		}

		if (area === 0) {
			// Polygon is so small that all points are on same pixel.
			center = points[0];
		} else {
			center = [x / area, y / area];
		}
		return this._map.layerPointToLatLng(center);
	},

	_convertLatLngs: function (latlngs) {
		var result = Polyline.prototype._convertLatLngs.call(this, latlngs),
		    len = result.length;

		// remove last point if it equals first one
		if (len >= 2 && result[0] instanceof LatLng && result[0].equals(result[len - 1])) {
			result.pop();
		}
		return result;
	},

	_setLatLngs: function (latlngs) {
		Polyline.prototype._setLatLngs.call(this, latlngs);
		if (isFlat(this._latlngs)) {
			this._latlngs = [this._latlngs];
		}
	},

	_defaultShape: function () {
		return isFlat(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
	},

	_clipPoints: function () {
		// polygons need a different clipping algorithm so we redefine that

		var bounds = this._renderer._bounds,
		    w = this.options.weight,
		    p = new Point(w, w);

		// increase clip padding by stroke width to avoid stroke on clip edges
		bounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));

		this._parts = [];
		if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		for (var i = 0, len = this._rings.length, clipped; i < len; i++) {
			clipped = clipPolygon(this._rings[i], bounds, true);
			if (clipped.length) {
				this._parts.push(clipped);
			}
		}
	},

	_updatePath: function () {
		this._renderer._updatePoly(this, true);
	},

	// Needed by the `Canvas` renderer for interactivity
	_containsPoint: function (p) {
		var inside = false,
		    part, p1, p2, i, j, k, len, len2;

		if (!this._pxBounds || !this._pxBounds.contains(p)) { return false; }

		// ray casting algorithm for detecting if point is in polygon
		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				p1 = part[j];
				p2 = part[k];

				if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
					inside = !inside;
				}
			}
		}

		// also check if it's on polygon stroke
		return inside || Polyline.prototype._containsPoint.call(this, p, true);
	}

});


// @factory L.polygon(latlngs: LatLng[], options?: Polyline options)
function polygon(latlngs, options) {
	return new Polygon(latlngs, options);
}

/*
 * @class GeoJSON
 * @aka L.GeoJSON
 * @inherits FeatureGroup
 *
 * Represents a GeoJSON object or an array of GeoJSON objects. Allows you to parse
 * GeoJSON data and display it on the map. Extends `FeatureGroup`.
 *
 * @example
 *
 * ```js
 * L.geoJSON(data, {
 * 	style: function (feature) {
 * 		return {color: feature.properties.color};
 * 	}
 * }).bindPopup(function (layer) {
 * 	return layer.feature.properties.description;
 * }).addTo(map);
 * ```
 */

var GeoJSON = FeatureGroup.extend({

	/* @section
	 * @aka GeoJSON options
	 *
	 * @option pointToLayer: Function = *
	 * A `Function` defining how GeoJSON points spawn Leaflet layers. It is internally
	 * called when data is added, passing the GeoJSON point feature and its `LatLng`.
	 * The default is to spawn a default `Marker`:
	 * ```js
	 * function(geoJsonPoint, latlng) {
	 * 	return L.marker(latlng);
	 * }
	 * ```
	 *
	 * @option style: Function = *
	 * A `Function` defining the `Path options` for styling GeoJSON lines and polygons,
	 * called internally when data is added.
	 * The default value is to not override any defaults:
	 * ```js
	 * function (geoJsonFeature) {
	 * 	return {}
	 * }
	 * ```
	 *
	 * @option onEachFeature: Function = *
	 * A `Function` that will be called once for each created `Feature`, after it has
	 * been created and styled. Useful for attaching events and popups to features.
	 * The default is to do nothing with the newly created layers:
	 * ```js
	 * function (feature, layer) {}
	 * ```
	 *
	 * @option filter: Function = *
	 * A `Function` that will be used to decide whether to include a feature or not.
	 * The default is to include all features:
	 * ```js
	 * function (geoJsonFeature) {
	 * 	return true;
	 * }
	 * ```
	 * Note: dynamically changing the `filter` option will have effect only on newly
	 * added data. It will _not_ re-evaluate already included features.
	 *
	 * @option coordsToLatLng: Function = *
	 * A `Function` that will be used for converting GeoJSON coordinates to `LatLng`s.
	 * The default is the `coordsToLatLng` static method.
	 */

	initialize: function (geojson, options) {
		setOptions(this, options);

		this._layers = {};

		if (geojson) {
			this.addData(geojson);
		}
	},

	// @method addData( <GeoJSON> data ): this
	// Adds a GeoJSON object to the layer.
	addData: function (geojson) {
		var features = isArray(geojson) ? geojson : geojson.features,
		    i, len, feature;

		if (features) {
			for (i = 0, len = features.length; i < len; i++) {
				// only add this if geometry or geometries are set and not null
				feature = features[i];
				if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
					this.addData(feature);
				}
			}
			return this;
		}

		var options = this.options;

		if (options.filter && !options.filter(geojson)) { return this; }

		var layer = geometryToLayer(geojson, options);
		if (!layer) {
			return this;
		}
		layer.feature = asFeature(geojson);

		layer.defaultOptions = layer.options;
		this.resetStyle(layer);

		if (options.onEachFeature) {
			options.onEachFeature(geojson, layer);
		}

		return this.addLayer(layer);
	},

	// @method resetStyle( <Path> layer ): this
	// Resets the given vector layer's style to the original GeoJSON style, useful for resetting style after hover events.
	resetStyle: function (layer) {
		// reset any custom styles
		layer.options = extend({}, layer.defaultOptions);
		this._setLayerStyle(layer, this.options.style);
		return this;
	},

	// @method setStyle( <Function> style ): this
	// Changes styles of GeoJSON vector layers with the given style function.
	setStyle: function (style) {
		return this.eachLayer(function (layer) {
			this._setLayerStyle(layer, style);
		}, this);
	},

	_setLayerStyle: function (layer, style) {
		if (layer.setStyle) {
			if (typeof style === 'function') {
				style = style(layer.feature);
			}
			layer.setStyle(style);
		}
	}
});

// @section
// There are several static functions which can be called without instantiating L.GeoJSON:

// @function geometryToLayer(featureData: Object, options?: GeoJSON options): Layer
// Creates a `Layer` from a given GeoJSON feature. Can use a custom
// [`pointToLayer`](#geojson-pointtolayer) and/or [`coordsToLatLng`](#geojson-coordstolatlng)
// functions if provided as options.
function geometryToLayer(geojson, options) {

	var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
	    coords = geometry ? geometry.coordinates : null,
	    layers = [],
	    pointToLayer = options && options.pointToLayer,
	    _coordsToLatLng = options && options.coordsToLatLng || coordsToLatLng,
	    latlng, latlngs, i, len;

	if (!coords && !geometry) {
		return null;
	}

	switch (geometry.type) {
	case 'Point':
		latlng = _coordsToLatLng(coords);
		return pointToLayer ? pointToLayer(geojson, latlng) : new Marker(latlng);

	case 'MultiPoint':
		for (i = 0, len = coords.length; i < len; i++) {
			latlng = _coordsToLatLng(coords[i]);
			layers.push(pointToLayer ? pointToLayer(geojson, latlng) : new Marker(latlng));
		}
		return new FeatureGroup(layers);

	case 'LineString':
	case 'MultiLineString':
		latlngs = coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng);
		return new Polyline(latlngs, options);

	case 'Polygon':
	case 'MultiPolygon':
		latlngs = coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng);
		return new Polygon(latlngs, options);

	case 'GeometryCollection':
		for (i = 0, len = geometry.geometries.length; i < len; i++) {
			var layer = geometryToLayer({
				geometry: geometry.geometries[i],
				type: 'Feature',
				properties: geojson.properties
			}, options);

			if (layer) {
				layers.push(layer);
			}
		}
		return new FeatureGroup(layers);

	default:
		throw new Error('Invalid GeoJSON object.');
	}
}

// @function coordsToLatLng(coords: Array): LatLng
// Creates a `LatLng` object from an array of 2 numbers (longitude, latitude)
// or 3 numbers (longitude, latitude, altitude) used in GeoJSON for points.
function coordsToLatLng(coords) {
	return new LatLng(coords[1], coords[0], coords[2]);
}

// @function coordsToLatLngs(coords: Array, levelsDeep?: Number, coordsToLatLng?: Function): Array
// Creates a multidimensional array of `LatLng`s from a GeoJSON coordinates array.
// `levelsDeep` specifies the nesting level (0 is for an array of points, 1 for an array of arrays of points, etc., 0 by default).
// Can use a custom [`coordsToLatLng`](#geojson-coordstolatlng) function.
function coordsToLatLngs(coords, levelsDeep, _coordsToLatLng) {
	var latlngs = [];

	for (var i = 0, len = coords.length, latlng; i < len; i++) {
		latlng = levelsDeep ?
			coordsToLatLngs(coords[i], levelsDeep - 1, _coordsToLatLng) :
			(_coordsToLatLng || coordsToLatLng)(coords[i]);

		latlngs.push(latlng);
	}

	return latlngs;
}

// @function latLngToCoords(latlng: LatLng, precision?: Number): Array
// Reverse of [`coordsToLatLng`](#geojson-coordstolatlng)
function latLngToCoords(latlng, precision) {
	precision = typeof precision === 'number' ? precision : 6;
	return latlng.alt !== undefined ?
		[formatNum(latlng.lng, precision), formatNum(latlng.lat, precision), formatNum(latlng.alt, precision)] :
		[formatNum(latlng.lng, precision), formatNum(latlng.lat, precision)];
}

// @function latLngsToCoords(latlngs: Array, levelsDeep?: Number, closed?: Boolean): Array
// Reverse of [`coordsToLatLngs`](#geojson-coordstolatlngs)
// `closed` determines whether the first point should be appended to the end of the array to close the feature, only used when `levelsDeep` is 0. False by default.
function latLngsToCoords(latlngs, levelsDeep, closed, precision) {
	var coords = [];

	for (var i = 0, len = latlngs.length; i < len; i++) {
		coords.push(levelsDeep ?
			latLngsToCoords(latlngs[i], levelsDeep - 1, closed, precision) :
			latLngToCoords(latlngs[i], precision));
	}

	if (!levelsDeep && closed) {
		coords.push(coords[0]);
	}

	return coords;
}

function getFeature(layer, newGeometry) {
	return layer.feature ?
		extend({}, layer.feature, {geometry: newGeometry}) :
		asFeature(newGeometry);
}

// @function asFeature(geojson: Object): Object
// Normalize GeoJSON geometries/features into GeoJSON features.
function asFeature(geojson) {
	if (geojson.type === 'Feature' || geojson.type === 'FeatureCollection') {
		return geojson;
	}

	return {
		type: 'Feature',
		properties: {},
		geometry: geojson
	};
}

var PointToGeoJSON = {
	toGeoJSON: function (precision) {
		return getFeature(this, {
			type: 'Point',
			coordinates: latLngToCoords(this.getLatLng(), precision)
		});
	}
};

// @namespace Marker
// @method toGeoJSON(precision?: Number): Object
// `precision` is the number of decimal places for coordinates.
// The default value is 6 places.
// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the marker (as a GeoJSON `Point` Feature).
Marker.include(PointToGeoJSON);

// @namespace CircleMarker
// @method toGeoJSON(precision?: Number): Object
// `precision` is the number of decimal places for coordinates.
// The default value is 6 places.
// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the circle marker (as a GeoJSON `Point` Feature).
Circle.include(PointToGeoJSON);
CircleMarker.include(PointToGeoJSON);


// @namespace Polyline
// @method toGeoJSON(precision?: Number): Object
// `precision` is the number of decimal places for coordinates.
// The default value is 6 places.
// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the polyline (as a GeoJSON `LineString` or `MultiLineString` Feature).
Polyline.include({
	toGeoJSON: function (precision) {
		var multi = !isFlat(this._latlngs);

		var coords = latLngsToCoords(this._latlngs, multi ? 1 : 0, false, precision);

		return getFeature(this, {
			type: (multi ? 'Multi' : '') + 'LineString',
			coordinates: coords
		});
	}
});

// @namespace Polygon
// @method toGeoJSON(precision?: Number): Object
// `precision` is the number of decimal places for coordinates.
// The default value is 6 places.
// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the polygon (as a GeoJSON `Polygon` or `MultiPolygon` Feature).
Polygon.include({
	toGeoJSON: function (precision) {
		var holes = !isFlat(this._latlngs),
		    multi = holes && !isFlat(this._latlngs[0]);

		var coords = latLngsToCoords(this._latlngs, multi ? 2 : holes ? 1 : 0, true, precision);

		if (!holes) {
			coords = [coords];
		}

		return getFeature(this, {
			type: (multi ? 'Multi' : '') + 'Polygon',
			coordinates: coords
		});
	}
});


// @namespace LayerGroup
LayerGroup.include({
	toMultiPoint: function (precision) {
		var coords = [];

		this.eachLayer(function (layer) {
			coords.push(layer.toGeoJSON(precision).geometry.coordinates);
		});

		return getFeature(this, {
			type: 'MultiPoint',
			coordinates: coords
		});
	},

	// @method toGeoJSON(precision?: Number): Object
	// `precision` is the number of decimal places for coordinates.
	// The default value is 6 places.
	// Returns a [`GeoJSON`](http://en.wikipedia.org/wiki/GeoJSON) representation of the layer group (as a GeoJSON `FeatureCollection`, `GeometryCollection`, or `MultiPoint`).
	toGeoJSON: function (precision) {

		var type = this.feature && this.feature.geometry && this.feature.geometry.type;

		if (type === 'MultiPoint') {
			return this.toMultiPoint(precision);
		}

		var isGeometryCollection = type === 'GeometryCollection',
		    jsons = [];

		this.eachLayer(function (layer) {
			if (layer.toGeoJSON) {
				var json = layer.toGeoJSON(precision);
				if (isGeometryCollection) {
					jsons.push(json.geometry);
				} else {
					var feature = asFeature(json);
					// Squash nested feature collections
					if (feature.type === 'FeatureCollection') {
						jsons.push.apply(jsons, feature.features);
					} else {
						jsons.push(feature);
					}
				}
			}
		});

		if (isGeometryCollection) {
			return getFeature(this, {
				geometries: jsons,
				type: 'GeometryCollection'
			});
		}

		return {
			type: 'FeatureCollection',
			features: jsons
		};
	}
});

// @namespace GeoJSON
// @factory L.geoJSON(geojson?: Object, options?: GeoJSON options)
// Creates a GeoJSON layer. Optionally accepts an object in
// [GeoJSON format](https://tools.ietf.org/html/rfc7946) to display on the map
// (you can alternatively add it later with `addData` method) and an `options` object.
function geoJSON(geojson, options) {
	return new GeoJSON(geojson, options);
}

// Backward compatibility.
var geoJson = geoJSON;

/*
 * @class ImageOverlay
 * @aka L.ImageOverlay
 * @inherits Interactive layer
 *
 * Used to load and display a single image over specific bounds of the map. Extends `Layer`.
 *
 * @example
 *
 * ```js
 * var imageUrl = 'http://www.lib.utexas.edu/maps/historical/newark_nj_1922.jpg',
 * 	imageBounds = [[40.712216, -74.22655], [40.773941, -74.12544]];
 * L.imageOverlay(imageUrl, imageBounds).addTo(map);
 * ```
 */

var ImageOverlay = Layer.extend({

	// @section
	// @aka ImageOverlay options
	options: {
		// @option opacity: Number = 1.0
		// The opacity of the image overlay.
		opacity: 1,

		// @option alt: String = ''
		// Text for the `alt` attribute of the image (useful for accessibility).
		alt: '',

		// @option interactive: Boolean = false
		// If `true`, the image overlay will emit [mouse events](#interactive-layer) when clicked or hovered.
		interactive: false,

		// @option crossOrigin: Boolean|String = false
		// Whether the crossOrigin attribute will be added to the image.
		// If a String is provided, the image will have its crossOrigin attribute set to the String provided. This is needed if you want to access image pixel data.
		// Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
		crossOrigin: false,

		// @option errorOverlayUrl: String = ''
		// URL to the overlay image to show in place of the overlay that failed to load.
		errorOverlayUrl: '',

		// @option zIndex: Number = 1
		// The explicit [zIndex](https://developer.mozilla.org/docs/Web/CSS/CSS_Positioning/Understanding_z_index) of the overlay layer.
		zIndex: 1,

		// @option className: String = ''
		// A custom class name to assign to the image. Empty by default.
		className: ''
	},

	initialize: function (url, bounds, options) { // (String, LatLngBounds, Object)
		this._url = url;
		this._bounds = toLatLngBounds(bounds);

		setOptions(this, options);
	},

	onAdd: function () {
		if (!this._image) {
			this._initImage();

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}

		if (this.options.interactive) {
			addClass(this._image, 'leaflet-interactive');
			this.addInteractiveTarget(this._image);
		}

		this.getPane().appendChild(this._image);
		this._reset();
	},

	onRemove: function () {
		remove(this._image);
		if (this.options.interactive) {
			this.removeInteractiveTarget(this._image);
		}
	},

	// @method setOpacity(opacity: Number): this
	// Sets the opacity of the overlay.
	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._image) {
			this._updateOpacity();
		}
		return this;
	},

	setStyle: function (styleOpts) {
		if (styleOpts.opacity) {
			this.setOpacity(styleOpts.opacity);
		}
		return this;
	},

	// @method bringToFront(): this
	// Brings the layer to the top of all overlays.
	bringToFront: function () {
		if (this._map) {
			toFront(this._image);
		}
		return this;
	},

	// @method bringToBack(): this
	// Brings the layer to the bottom of all overlays.
	bringToBack: function () {
		if (this._map) {
			toBack(this._image);
		}
		return this;
	},

	// @method setUrl(url: String): this
	// Changes the URL of the image.
	setUrl: function (url) {
		this._url = url;

		if (this._image) {
			this._image.src = url;
		}
		return this;
	},

	// @method setBounds(bounds: LatLngBounds): this
	// Update the bounds that this ImageOverlay covers
	setBounds: function (bounds) {
		this._bounds = toLatLngBounds(bounds);

		if (this._map) {
			this._reset();
		}
		return this;
	},

	getEvents: function () {
		var events = {
			zoom: this._reset,
			viewreset: this._reset
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	// @method setZIndex(value: Number): this
	// Changes the [zIndex](#imageoverlay-zindex) of the image overlay.
	setZIndex: function (value) {
		this.options.zIndex = value;
		this._updateZIndex();
		return this;
	},

	// @method getBounds(): LatLngBounds
	// Get the bounds that this ImageOverlay covers
	getBounds: function () {
		return this._bounds;
	},

	// @method getElement(): HTMLElement
	// Returns the instance of [`HTMLImageElement`](https://developer.mozilla.org/docs/Web/API/HTMLImageElement)
	// used by this overlay.
	getElement: function () {
		return this._image;
	},

	_initImage: function () {
		var wasElementSupplied = this._url.tagName === 'IMG';
		var img = this._image = wasElementSupplied ? this._url : create$1('img');

		addClass(img, 'leaflet-image-layer');
		if (this._zoomAnimated) { addClass(img, 'leaflet-zoom-animated'); }
		if (this.options.className) { addClass(img, this.options.className); }

		img.onselectstart = falseFn;
		img.onmousemove = falseFn;

		// @event load: Event
		// Fired when the ImageOverlay layer has loaded its image
		img.onload = bind(this.fire, this, 'load');
		img.onerror = bind(this._overlayOnError, this, 'error');

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
		}

		if (this.options.zIndex) {
			this._updateZIndex();
		}

		if (wasElementSupplied) {
			this._url = img.src;
			return;
		}

		img.src = this._url;
		img.alt = this.options.alt;
	},

	_animateZoom: function (e) {
		var scale = this._map.getZoomScale(e.zoom),
		    offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;

		setTransform(this._image, offset, scale);
	},

	_reset: function () {
		var image = this._image,
		    bounds = new Bounds(
		        this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
		        this._map.latLngToLayerPoint(this._bounds.getSouthEast())),
		    size = bounds.getSize();

		setPosition(image, bounds.min);

		image.style.width  = size.x + 'px';
		image.style.height = size.y + 'px';
	},

	_updateOpacity: function () {
		setOpacity(this._image, this.options.opacity);
	},

	_updateZIndex: function () {
		if (this._image && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._image.style.zIndex = this.options.zIndex;
		}
	},

	_overlayOnError: function () {
		// @event error: Event
		// Fired when the ImageOverlay layer fails to load its image
		this.fire('error');

		var errorUrl = this.options.errorOverlayUrl;
		if (errorUrl && this._url !== errorUrl) {
			this._url = errorUrl;
			this._image.src = errorUrl;
		}
	}
});

// @factory L.imageOverlay(imageUrl: String, bounds: LatLngBounds, options?: ImageOverlay options)
// Instantiates an image overlay object given the URL of the image and the
// geographical bounds it is tied to.
var imageOverlay = function (url, bounds, options) {
	return new ImageOverlay(url, bounds, options);
};

/*
 * @class VideoOverlay
 * @aka L.VideoOverlay
 * @inherits ImageOverlay
 *
 * Used to load and display a video player over specific bounds of the map. Extends `ImageOverlay`.
 *
 * A video overlay uses the [`<video>`](https://developer.mozilla.org/docs/Web/HTML/Element/video)
 * HTML5 element.
 *
 * @example
 *
 * ```js
 * var videoUrl = 'https://www.mapbox.com/bites/00188/patricia_nasa.webm',
 * 	videoBounds = [[ 32, -130], [ 13, -100]];
 * L.videoOverlay(videoUrl, videoBounds ).addTo(map);
 * ```
 */

var VideoOverlay = ImageOverlay.extend({

	// @section
	// @aka VideoOverlay options
	options: {
		// @option autoplay: Boolean = true
		// Whether the video starts playing automatically when loaded.
		autoplay: true,

		// @option loop: Boolean = true
		// Whether the video will loop back to the beginning when played.
		loop: true,

		// @option keepAspectRatio: Boolean = true
		// Whether the video will save aspect ratio after the projection.
		// Relevant for supported browsers. Browser compatibility- https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit
		keepAspectRatio: true
	},

	_initImage: function () {
		var wasElementSupplied = this._url.tagName === 'VIDEO';
		var vid = this._image = wasElementSupplied ? this._url : create$1('video');

		addClass(vid, 'leaflet-image-layer');
		if (this._zoomAnimated) { addClass(vid, 'leaflet-zoom-animated'); }

		vid.onselectstart = falseFn;
		vid.onmousemove = falseFn;

		// @event load: Event
		// Fired when the video has finished loading the first frame
		vid.onloadeddata = bind(this.fire, this, 'load');

		if (wasElementSupplied) {
			var sourceElements = vid.getElementsByTagName('source');
			var sources = [];
			for (var j = 0; j < sourceElements.length; j++) {
				sources.push(sourceElements[j].src);
			}

			this._url = (sourceElements.length > 0) ? sources : [vid.src];
			return;
		}

		if (!isArray(this._url)) { this._url = [this._url]; }

		if (!this.options.keepAspectRatio && vid.style.hasOwnProperty('objectFit')) { vid.style['objectFit'] = 'fill'; }
		vid.autoplay = !!this.options.autoplay;
		vid.loop = !!this.options.loop;
		for (var i = 0; i < this._url.length; i++) {
			var source = create$1('source');
			source.src = this._url[i];
			vid.appendChild(source);
		}
	}

	// @method getElement(): HTMLVideoElement
	// Returns the instance of [`HTMLVideoElement`](https://developer.mozilla.org/docs/Web/API/HTMLVideoElement)
	// used by this overlay.
});


// @factory L.videoOverlay(video: String|Array|HTMLVideoElement, bounds: LatLngBounds, options?: VideoOverlay options)
// Instantiates an image overlay object given the URL of the video (or array of URLs, or even a video element) and the
// geographical bounds it is tied to.

function videoOverlay(video, bounds, options) {
	return new VideoOverlay(video, bounds, options);
}

/*
 * @class SVGOverlay
 * @aka L.SVGOverlay
 * @inherits ImageOverlay
 *
 * Used to load, display and provide DOM access to an SVG file over specific bounds of the map. Extends `ImageOverlay`.
 *
 * An SVG overlay uses the [`<svg>`](https://developer.mozilla.org/docs/Web/SVG/Element/svg) element.
 *
 * @example
 *
 * ```js
 * var element = '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="https://mdn.mozillademos.org/files/6457/mdn_logo_only_color.png" height="200" width="200"/></svg>',
 * 		 elementBounds = [ [ 32, -130 ], [ 13, -100 ] ];
 * L.svgOverlay(element, elementBounds).addTo(map);
 * ```
 */

var SVGOverlay = ImageOverlay.extend({
	_initImage: function () {
		var el = this._image = this._url;

		addClass(el, 'leaflet-image-layer');
		if (this._zoomAnimated) { addClass(el, 'leaflet-zoom-animated'); }

		el.onselectstart = falseFn;
		el.onmousemove = falseFn;
	}

	// @method getElement(): SVGElement
	// Returns the instance of [`SVGElement`](https://developer.mozilla.org/docs/Web/API/SVGElement)
	// used by this overlay.
});


// @factory L.svgOverlay(svg: String|SVGElement, bounds: LatLngBounds, options?: SVGOverlay options)
// Instantiates an image overlay object given an SVG element and the geographical bounds it is tied to.
// A viewBox attribute is required on the SVG element to zoom in and out properly.

function svgOverlay(el, bounds, options) {
	return new SVGOverlay(el, bounds, options);
}

/*
 * @class DivOverlay
 * @inherits Layer
 * @aka L.DivOverlay
 * Base model for L.Popup and L.Tooltip. Inherit from it for custom popup like plugins.
 */

// @namespace DivOverlay
var DivOverlay = Layer.extend({

	// @section
	// @aka DivOverlay options
	options: {
		// @option offset: Point = Point(0, 7)
		// The offset of the popup position. Useful to control the anchor
		// of the popup when opening it on some overlays.
		offset: [0, 7],

		// @option className: String = ''
		// A custom CSS class name to assign to the popup.
		className: '',

		// @option pane: String = 'popupPane'
		// `Map pane` where the popup will be added.
		pane: 'popupPane'
	},

	initialize: function (options, source) {
		setOptions(this, options);

		this._source = source;
	},

	onAdd: function (map) {
		this._zoomAnimated = map._zoomAnimated;

		if (!this._container) {
			this._initLayout();
		}

		if (map._fadeAnimated) {
			setOpacity(this._container, 0);
		}

		clearTimeout(this._removeTimeout);
		this.getPane().appendChild(this._container);
		this.update();

		if (map._fadeAnimated) {
			setOpacity(this._container, 1);
		}

		this.bringToFront();
	},

	onRemove: function (map) {
		if (map._fadeAnimated) {
			setOpacity(this._container, 0);
			this._removeTimeout = setTimeout(bind(remove, undefined, this._container), 200);
		} else {
			remove(this._container);
		}
	},

	// @namespace Popup
	// @method getLatLng: LatLng
	// Returns the geographical point of popup.
	getLatLng: function () {
		return this._latlng;
	},

	// @method setLatLng(latlng: LatLng): this
	// Sets the geographical point where the popup will open.
	setLatLng: function (latlng) {
		this._latlng = toLatLng(latlng);
		if (this._map) {
			this._updatePosition();
			this._adjustPan();
		}
		return this;
	},

	// @method getContent: String|HTMLElement
	// Returns the content of the popup.
	getContent: function () {
		return this._content;
	},

	// @method setContent(htmlContent: String|HTMLElement|Function): this
	// Sets the HTML content of the popup. If a function is passed the source layer will be passed to the function. The function should return a `String` or `HTMLElement` to be used in the popup.
	setContent: function (content) {
		this._content = content;
		this.update();
		return this;
	},

	// @method getElement: String|HTMLElement
	// Alias for [getContent()](#popup-getcontent)
	getElement: function () {
		return this._container;
	},

	// @method update: null
	// Updates the popup content, layout and position. Useful for updating the popup after something inside changed, e.g. image loaded.
	update: function () {
		if (!this._map) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';

		this._adjustPan();
	},

	getEvents: function () {
		var events = {
			zoom: this._updatePosition,
			viewreset: this._updatePosition
		};

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}
		return events;
	},

	// @method isOpen: Boolean
	// Returns `true` when the popup is visible on the map.
	isOpen: function () {
		return !!this._map && this._map.hasLayer(this);
	},

	// @method bringToFront: this
	// Brings this popup in front of other popups (in the same map pane).
	bringToFront: function () {
		if (this._map) {
			toFront(this._container);
		}
		return this;
	},

	// @method bringToBack: this
	// Brings this popup to the back of other popups (in the same map pane).
	bringToBack: function () {
		if (this._map) {
			toBack(this._container);
		}
		return this;
	},

	_prepareOpen: function (parent, layer, latlng) {
		if (!(layer instanceof Layer)) {
			latlng = layer;
			layer = parent;
		}

		if (layer instanceof FeatureGroup) {
			for (var id in parent._layers) {
				layer = parent._layers[id];
				break;
			}
		}

		if (!latlng) {
			if (layer.getCenter) {
				latlng = layer.getCenter();
			} else if (layer.getLatLng) {
				latlng = layer.getLatLng();
			} else {
				throw new Error('Unable to get source layer LatLng.');
			}
		}

		// set overlay source to this layer
		this._source = layer;

		// update the overlay (content, layout, ect...)
		this.update();

		return latlng;
	},

	_updateContent: function () {
		if (!this._content) { return; }

		var node = this._contentNode;
		var content = (typeof this._content === 'function') ? this._content(this._source || this) : this._content;

		if (typeof content === 'string') {
			node.innerHTML = content;
		} else {
			while (node.hasChildNodes()) {
				node.removeChild(node.firstChild);
			}
			node.appendChild(content);
		}
		this.fire('contentupdate');
	},

	_updatePosition: function () {
		if (!this._map) { return; }

		var pos = this._map.latLngToLayerPoint(this._latlng),
		    offset = toPoint(this.options.offset),
		    anchor = this._getAnchor();

		if (this._zoomAnimated) {
			setPosition(this._container, pos.add(anchor));
		} else {
			offset = offset.add(pos).add(anchor);
		}

		var bottom = this._containerBottom = -offset.y,
		    left = this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x;

		// bottom position the popup in case the height of the popup changes (images loading etc)
		this._container.style.bottom = bottom + 'px';
		this._container.style.left = left + 'px';
	},

	_getAnchor: function () {
		return [0, 0];
	}

});

/*
 * @class Popup
 * @inherits DivOverlay
 * @aka L.Popup
 * Used to open popups in certain places of the map. Use [Map.openPopup](#map-openpopup) to
 * open popups while making sure that only one popup is open at one time
 * (recommended for usability), or use [Map.addLayer](#map-addlayer) to open as many as you want.
 *
 * @example
 *
 * If you want to just bind a popup to marker click and then open it, it's really easy:
 *
 * ```js
 * marker.bindPopup(popupContent).openPopup();
 * ```
 * Path overlays like polylines also have a `bindPopup` method.
 * Here's a more complicated way to open a popup on a map:
 *
 * ```js
 * var popup = L.popup()
 * 	.setLatLng(latlng)
 * 	.setContent('<p>Hello world!<br />This is a nice popup.</p>')
 * 	.openOn(map);
 * ```
 */


// @namespace Popup
var Popup = DivOverlay.extend({

	// @section
	// @aka Popup options
	options: {
		// @option maxWidth: Number = 300
		// Max width of the popup, in pixels.
		maxWidth: 300,

		// @option minWidth: Number = 50
		// Min width of the popup, in pixels.
		minWidth: 50,

		// @option maxHeight: Number = null
		// If set, creates a scrollable container of the given height
		// inside a popup if its content exceeds it.
		maxHeight: null,

		// @option autoPan: Boolean = true
		// Set it to `false` if you don't want the map to do panning animation
		// to fit the opened popup.
		autoPan: true,

		// @option autoPanPaddingTopLeft: Point = null
		// The margin between the popup and the top left corner of the map
		// view after autopanning was performed.
		autoPanPaddingTopLeft: null,

		// @option autoPanPaddingBottomRight: Point = null
		// The margin between the popup and the bottom right corner of the map
		// view after autopanning was performed.
		autoPanPaddingBottomRight: null,

		// @option autoPanPadding: Point = Point(5, 5)
		// Equivalent of setting both top left and bottom right autopan padding to the same value.
		autoPanPadding: [5, 5],

		// @option keepInView: Boolean = false
		// Set it to `true` if you want to prevent users from panning the popup
		// off of the screen while it is open.
		keepInView: false,

		// @option closeButton: Boolean = true
		// Controls the presence of a close button in the popup.
		closeButton: true,

		// @option autoClose: Boolean = true
		// Set it to `false` if you want to override the default behavior of
		// the popup closing when another popup is opened.
		autoClose: true,

		// @option closeOnEscapeKey: Boolean = true
		// Set it to `false` if you want to override the default behavior of
		// the ESC key for closing of the popup.
		closeOnEscapeKey: true,

		// @option closeOnClick: Boolean = *
		// Set it if you want to override the default behavior of the popup closing when user clicks
		// on the map. Defaults to the map's [`closePopupOnClick`](#map-closepopuponclick) option.

		// @option className: String = ''
		// A custom CSS class name to assign to the popup.
		className: ''
	},

	// @namespace Popup
	// @method openOn(map: Map): this
	// Adds the popup to the map and closes the previous one. The same as `map.openPopup(popup)`.
	openOn: function (map) {
		map.openPopup(this);
		return this;
	},

	onAdd: function (map) {
		DivOverlay.prototype.onAdd.call(this, map);

		// @namespace Map
		// @section Popup events
		// @event popupopen: PopupEvent
		// Fired when a popup is opened in the map
		map.fire('popupopen', {popup: this});

		if (this._source) {
			// @namespace Layer
			// @section Popup events
			// @event popupopen: PopupEvent
			// Fired when a popup bound to this layer is opened
			this._source.fire('popupopen', {popup: this}, true);
			// For non-path layers, we toggle the popup when clicking
			// again the layer, so prevent the map to reopen it.
			if (!(this._source instanceof Path)) {
				this._source.on('preclick', stopPropagation);
			}
		}
	},

	onRemove: function (map) {
		DivOverlay.prototype.onRemove.call(this, map);

		// @namespace Map
		// @section Popup events
		// @event popupclose: PopupEvent
		// Fired when a popup in the map is closed
		map.fire('popupclose', {popup: this});

		if (this._source) {
			// @namespace Layer
			// @section Popup events
			// @event popupclose: PopupEvent
			// Fired when a popup bound to this layer is closed
			this._source.fire('popupclose', {popup: this}, true);
			if (!(this._source instanceof Path)) {
				this._source.off('preclick', stopPropagation);
			}
		}
	},

	getEvents: function () {
		var events = DivOverlay.prototype.getEvents.call(this);

		if (this.options.closeOnClick !== undefined ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
			events.preclick = this._close;
		}

		if (this.options.keepInView) {
			events.moveend = this._adjustPan;
		}

		return events;
	},

	_close: function () {
		if (this._map) {
			this._map.closePopup(this);
		}
	},

	_initLayout: function () {
		var prefix = 'leaflet-popup',
		    container = this._container = create$1('div',
			prefix + ' ' + (this.options.className || '') +
			' leaflet-zoom-animated');

		var wrapper = this._wrapper = create$1('div', prefix + '-content-wrapper', container);
		this._contentNode = create$1('div', prefix + '-content', wrapper);

		disableClickPropagation(wrapper);
		disableScrollPropagation(this._contentNode);
		on(wrapper, 'contextmenu', stopPropagation);

		this._tipContainer = create$1('div', prefix + '-tip-container', container);
		this._tip = create$1('div', prefix + '-tip', this._tipContainer);

		if (this.options.closeButton) {
			var closeButton = this._closeButton = create$1('a', prefix + '-close-button', container);
			closeButton.href = '#close';
			closeButton.innerHTML = '&#215;';

			on(closeButton, 'click', this._onCloseButtonClick, this);
		}
	},

	_updateLayout: function () {
		var container = this._contentNode,
		    style = container.style;

		style.width = '';
		style.whiteSpace = 'nowrap';

		var width = container.offsetWidth;
		width = Math.min(width, this.options.maxWidth);
		width = Math.max(width, this.options.minWidth);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';

		style.height = '';

		var height = container.offsetHeight,
		    maxHeight = this.options.maxHeight,
		    scrolledClass = 'leaflet-popup-scrolled';

		if (maxHeight && height > maxHeight) {
			style.height = maxHeight + 'px';
			addClass(container, scrolledClass);
		} else {
			removeClass(container, scrolledClass);
		}

		this._containerWidth = this._container.offsetWidth;
	},

	_animateZoom: function (e) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center),
		    anchor = this._getAnchor();
		setPosition(this._container, pos.add(anchor));
	},

	_adjustPan: function () {
		if (!this.options.autoPan) { return; }
		if (this._map._panAnim) { this._map._panAnim.stop(); }

		var map = this._map,
		    marginBottom = parseInt(getStyle(this._container, 'marginBottom'), 10) || 0,
		    containerHeight = this._container.offsetHeight + marginBottom,
		    containerWidth = this._containerWidth,
		    layerPos = new Point(this._containerLeft, -containerHeight - this._containerBottom);

		layerPos._add(getPosition(this._container));

		var containerPos = map.layerPointToContainerPoint(layerPos),
		    padding = toPoint(this.options.autoPanPadding),
		    paddingTL = toPoint(this.options.autoPanPaddingTopLeft || padding),
		    paddingBR = toPoint(this.options.autoPanPaddingBottomRight || padding),
		    size = map.getSize(),
		    dx = 0,
		    dy = 0;

		if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
			dx = containerPos.x + containerWidth - size.x + paddingBR.x;
		}
		if (containerPos.x - dx - paddingTL.x < 0) { // left
			dx = containerPos.x - paddingTL.x;
		}
		if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
			dy = containerPos.y + containerHeight - size.y + paddingBR.y;
		}
		if (containerPos.y - dy - paddingTL.y < 0) { // top
			dy = containerPos.y - paddingTL.y;
		}

		// @namespace Map
		// @section Popup events
		// @event autopanstart: Event
		// Fired when the map starts autopanning when opening a popup.
		if (dx || dy) {
			map
			    .fire('autopanstart')
			    .panBy([dx, dy]);
		}
	},

	_onCloseButtonClick: function (e) {
		this._close();
		stop(e);
	},

	_getAnchor: function () {
		// Where should we anchor the popup on the source layer?
		return toPoint(this._source && this._source._getPopupAnchor ? this._source._getPopupAnchor() : [0, 0]);
	}

});

// @namespace Popup
// @factory L.popup(options?: Popup options, source?: Layer)
// Instantiates a `Popup` object given an optional `options` object that describes its appearance and location and an optional `source` object that is used to tag the popup with a reference to the Layer to which it refers.
var popup = function (options, source) {
	return new Popup(options, source);
};


/* @namespace Map
 * @section Interaction Options
 * @option closePopupOnClick: Boolean = true
 * Set it to `false` if you don't want popups to close when user clicks the map.
 */
Map.mergeOptions({
	closePopupOnClick: true
});


// @namespace Map
// @section Methods for Layers and Controls
Map.include({
	// @method openPopup(popup: Popup): this
	// Opens the specified popup while closing the previously opened (to make sure only one is opened at one time for usability).
	// @alternative
	// @method openPopup(content: String|HTMLElement, latlng: LatLng, options?: Popup options): this
	// Creates a popup with the specified content and options and opens it in the given point on a map.
	openPopup: function (popup, latlng, options) {
		if (!(popup instanceof Popup)) {
			popup = new Popup(options).setContent(popup);
		}

		if (latlng) {
			popup.setLatLng(latlng);
		}

		if (this.hasLayer(popup)) {
			return this;
		}

		if (this._popup && this._popup.options.autoClose) {
			this.closePopup();
		}

		this._popup = popup;
		return this.addLayer(popup);
	},

	// @method closePopup(popup?: Popup): this
	// Closes the popup previously opened with [openPopup](#map-openpopup) (or the given one).
	closePopup: function (popup) {
		if (!popup || popup === this._popup) {
			popup = this._popup;
			this._popup = null;
		}
		if (popup) {
			this.removeLayer(popup);
		}
		return this;
	}
});

/*
 * @namespace Layer
 * @section Popup methods example
 *
 * All layers share a set of methods convenient for binding popups to it.
 *
 * ```js
 * var layer = L.Polygon(latlngs).bindPopup('Hi There!').addTo(map);
 * layer.openPopup();
 * layer.closePopup();
 * ```
 *
 * Popups will also be automatically opened when the layer is clicked on and closed when the layer is removed from the map or another popup is opened.
 */

// @section Popup methods
Layer.include({

	// @method bindPopup(content: String|HTMLElement|Function|Popup, options?: Popup options): this
	// Binds a popup to the layer with the passed `content` and sets up the
	// necessary event listeners. If a `Function` is passed it will receive
	// the layer as the first argument and should return a `String` or `HTMLElement`.
	bindPopup: function (content, options) {

		if (content instanceof Popup) {
			setOptions(content, options);
			this._popup = content;
			content._source = this;
		} else {
			if (!this._popup || options) {
				this._popup = new Popup(options, this);
			}
			this._popup.setContent(content);
		}

		if (!this._popupHandlersAdded) {
			this.on({
				click: this._openPopup,
				keypress: this._onKeyPress,
				remove: this.closePopup,
				move: this._movePopup
			});
			this._popupHandlersAdded = true;
		}

		return this;
	},

	// @method unbindPopup(): this
	// Removes the popup previously bound with `bindPopup`.
	unbindPopup: function () {
		if (this._popup) {
			this.off({
				click: this._openPopup,
				keypress: this._onKeyPress,
				remove: this.closePopup,
				move: this._movePopup
			});
			this._popupHandlersAdded = false;
			this._popup = null;
		}
		return this;
	},

	// @method openPopup(latlng?: LatLng): this
	// Opens the bound popup at the specified `latlng` or at the default popup anchor if no `latlng` is passed.
	openPopup: function (layer, latlng) {
		if (this._popup && this._map) {
			latlng = this._popup._prepareOpen(this, layer, latlng);

			// open the popup on the map
			this._map.openPopup(this._popup, latlng);
		}

		return this;
	},

	// @method closePopup(): this
	// Closes the popup bound to this layer if it is open.
	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	// @method togglePopup(): this
	// Opens or closes the popup bound to this layer depending on its current state.
	togglePopup: function (target) {
		if (this._popup) {
			if (this._popup._map) {
				this.closePopup();
			} else {
				this.openPopup(target);
			}
		}
		return this;
	},

	// @method isPopupOpen(): boolean
	// Returns `true` if the popup bound to this layer is currently open.
	isPopupOpen: function () {
		return (this._popup ? this._popup.isOpen() : false);
	},

	// @method setPopupContent(content: String|HTMLElement|Popup): this
	// Sets the content of the popup bound to this layer.
	setPopupContent: function (content) {
		if (this._popup) {
			this._popup.setContent(content);
		}
		return this;
	},

	// @method getPopup(): Popup
	// Returns the popup bound to this layer.
	getPopup: function () {
		return this._popup;
	},

	_openPopup: function (e) {
		var layer = e.layer || e.target;

		if (!this._popup) {
			return;
		}

		if (!this._map) {
			return;
		}

		// prevent map click
		stop(e);

		// if this inherits from Path its a vector and we can just
		// open the popup at the new location
		if (layer instanceof Path) {
			this.openPopup(e.layer || e.target, e.latlng);
			return;
		}

		// otherwise treat it like a marker and figure out
		// if we should toggle it open/closed
		if (this._map.hasLayer(this._popup) && this._popup._source === layer) {
			this.closePopup();
		} else {
			this.openPopup(layer, e.latlng);
		}
	},

	_movePopup: function (e) {
		this._popup.setLatLng(e.latlng);
	},

	_onKeyPress: function (e) {
		if (e.originalEvent.keyCode === 13) {
			this._openPopup(e);
		}
	}
});

/*
 * @class Tooltip
 * @inherits DivOverlay
 * @aka L.Tooltip
 * Used to display small texts on top of map layers.
 *
 * @example
 *
 * ```js
 * marker.bindTooltip("my tooltip text").openTooltip();
 * ```
 * Note about tooltip offset. Leaflet takes two options in consideration
 * for computing tooltip offsetting:
 * - the `offset` Tooltip option: it defaults to [0, 0], and it's specific to one tooltip.
 *   Add a positive x offset to move the tooltip to the right, and a positive y offset to
 *   move it to the bottom. Negatives will move to the left and top.
 * - the `tooltipAnchor` Icon option: this will only be considered for Marker. You
 *   should adapt this value if you use a custom icon.
 */


// @namespace Tooltip
var Tooltip = DivOverlay.extend({

	// @section
	// @aka Tooltip options
	options: {
		// @option pane: String = 'tooltipPane'
		// `Map pane` where the tooltip will be added.
		pane: 'tooltipPane',

		// @option offset: Point = Point(0, 0)
		// Optional offset of the tooltip position.
		offset: [0, 0],

		// @option direction: String = 'auto'
		// Direction where to open the tooltip. Possible values are: `right`, `left`,
		// `top`, `bottom`, `center`, `auto`.
		// `auto` will dynamically switch between `right` and `left` according to the tooltip
		// position on the map.
		direction: 'auto',

		// @option permanent: Boolean = false
		// Whether to open the tooltip permanently or only on mouseover.
		permanent: false,

		// @option sticky: Boolean = false
		// If true, the tooltip will follow the mouse instead of being fixed at the feature center.
		sticky: false,

		// @option interactive: Boolean = false
		// If true, the tooltip will listen to the feature events.
		interactive: false,

		// @option opacity: Number = 0.9
		// Tooltip container opacity.
		opacity: 0.9
	},

	onAdd: function (map) {
		DivOverlay.prototype.onAdd.call(this, map);
		this.setOpacity(this.options.opacity);

		// @namespace Map
		// @section Tooltip events
		// @event tooltipopen: TooltipEvent
		// Fired when a tooltip is opened in the map.
		map.fire('tooltipopen', {tooltip: this});

		if (this._source) {
			// @namespace Layer
			// @section Tooltip events
			// @event tooltipopen: TooltipEvent
			// Fired when a tooltip bound to this layer is opened.
			this._source.fire('tooltipopen', {tooltip: this}, true);
		}
	},

	onRemove: function (map) {
		DivOverlay.prototype.onRemove.call(this, map);

		// @namespace Map
		// @section Tooltip events
		// @event tooltipclose: TooltipEvent
		// Fired when a tooltip in the map is closed.
		map.fire('tooltipclose', {tooltip: this});

		if (this._source) {
			// @namespace Layer
			// @section Tooltip events
			// @event tooltipclose: TooltipEvent
			// Fired when a tooltip bound to this layer is closed.
			this._source.fire('tooltipclose', {tooltip: this}, true);
		}
	},

	getEvents: function () {
		var events = DivOverlay.prototype.getEvents.call(this);

		if (touch && !this.options.permanent) {
			events.preclick = this._close;
		}

		return events;
	},

	_close: function () {
		if (this._map) {
			this._map.closeTooltip(this);
		}
	},

	_initLayout: function () {
		var prefix = 'leaflet-tooltip',
		    className = prefix + ' ' + (this.options.className || '') + ' leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

		this._contentNode = this._container = create$1('div', className);
	},

	_updateLayout: function () {},

	_adjustPan: function () {},

	_setPosition: function (pos) {
		var map = this._map,
		    container = this._container,
		    centerPoint = map.latLngToContainerPoint(map.getCenter()),
		    tooltipPoint = map.layerPointToContainerPoint(pos),
		    direction = this.options.direction,
		    tooltipWidth = container.offsetWidth,
		    tooltipHeight = container.offsetHeight,
		    offset = toPoint(this.options.offset),
		    anchor = this._getAnchor();

		if (direction === 'top') {
			pos = pos.add(toPoint(-tooltipWidth / 2 + offset.x, -tooltipHeight + offset.y + anchor.y, true));
		} else if (direction === 'bottom') {
			pos = pos.subtract(toPoint(tooltipWidth / 2 - offset.x, -offset.y, true));
		} else if (direction === 'center') {
			pos = pos.subtract(toPoint(tooltipWidth / 2 + offset.x, tooltipHeight / 2 - anchor.y + offset.y, true));
		} else if (direction === 'right' || direction === 'auto' && tooltipPoint.x < centerPoint.x) {
			direction = 'right';
			pos = pos.add(toPoint(offset.x + anchor.x, anchor.y - tooltipHeight / 2 + offset.y, true));
		} else {
			direction = 'left';
			pos = pos.subtract(toPoint(tooltipWidth + anchor.x - offset.x, tooltipHeight / 2 - anchor.y - offset.y, true));
		}

		removeClass(container, 'leaflet-tooltip-right');
		removeClass(container, 'leaflet-tooltip-left');
		removeClass(container, 'leaflet-tooltip-top');
		removeClass(container, 'leaflet-tooltip-bottom');
		addClass(container, 'leaflet-tooltip-' + direction);
		setPosition(container, pos);
	},

	_updatePosition: function () {
		var pos = this._map.latLngToLayerPoint(this._latlng);
		this._setPosition(pos);
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._container) {
			setOpacity(this._container, opacity);
		}
	},

	_animateZoom: function (e) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
		this._setPosition(pos);
	},

	_getAnchor: function () {
		// Where should we anchor the tooltip on the source layer?
		return toPoint(this._source && this._source._getTooltipAnchor && !this.options.sticky ? this._source._getTooltipAnchor() : [0, 0]);
	}

});

// @namespace Tooltip
// @factory L.tooltip(options?: Tooltip options, source?: Layer)
// Instantiates a Tooltip object given an optional `options` object that describes its appearance and location and an optional `source` object that is used to tag the tooltip with a reference to the Layer to which it refers.
var tooltip = function (options, source) {
	return new Tooltip(options, source);
};

// @namespace Map
// @section Methods for Layers and Controls
Map.include({

	// @method openTooltip(tooltip: Tooltip): this
	// Opens the specified tooltip.
	// @alternative
	// @method openTooltip(content: String|HTMLElement, latlng: LatLng, options?: Tooltip options): this
	// Creates a tooltip with the specified content and options and open it.
	openTooltip: function (tooltip, latlng, options) {
		if (!(tooltip instanceof Tooltip)) {
			tooltip = new Tooltip(options).setContent(tooltip);
		}

		if (latlng) {
			tooltip.setLatLng(latlng);
		}

		if (this.hasLayer(tooltip)) {
			return this;
		}

		return this.addLayer(tooltip);
	},

	// @method closeTooltip(tooltip?: Tooltip): this
	// Closes the tooltip given as parameter.
	closeTooltip: function (tooltip) {
		if (tooltip) {
			this.removeLayer(tooltip);
		}
		return this;
	}

});

/*
 * @namespace Layer
 * @section Tooltip methods example
 *
 * All layers share a set of methods convenient for binding tooltips to it.
 *
 * ```js
 * var layer = L.Polygon(latlngs).bindTooltip('Hi There!').addTo(map);
 * layer.openTooltip();
 * layer.closeTooltip();
 * ```
 */

// @section Tooltip methods
Layer.include({

	// @method bindTooltip(content: String|HTMLElement|Function|Tooltip, options?: Tooltip options): this
	// Binds a tooltip to the layer with the passed `content` and sets up the
	// necessary event listeners. If a `Function` is passed it will receive
	// the layer as the first argument and should return a `String` or `HTMLElement`.
	bindTooltip: function (content, options) {

		if (content instanceof Tooltip) {
			setOptions(content, options);
			this._tooltip = content;
			content._source = this;
		} else {
			if (!this._tooltip || options) {
				this._tooltip = new Tooltip(options, this);
			}
			this._tooltip.setContent(content);

		}

		this._initTooltipInteractions();

		if (this._tooltip.options.permanent && this._map && this._map.hasLayer(this)) {
			this.openTooltip();
		}

		return this;
	},

	// @method unbindTooltip(): this
	// Removes the tooltip previously bound with `bindTooltip`.
	unbindTooltip: function () {
		if (this._tooltip) {
			this._initTooltipInteractions(true);
			this.closeTooltip();
			this._tooltip = null;
		}
		return this;
	},

	_initTooltipInteractions: function (remove$$1) {
		if (!remove$$1 && this._tooltipHandlersAdded) { return; }
		var onOff = remove$$1 ? 'off' : 'on',
		    events = {
			remove: this.closeTooltip,
			move: this._moveTooltip
		    };
		if (!this._tooltip.options.permanent) {
			events.mouseover = this._openTooltip;
			events.mouseout = this.closeTooltip;
			if (this._tooltip.options.sticky) {
				events.mousemove = this._moveTooltip;
			}
			if (touch) {
				events.click = this._openTooltip;
			}
		} else {
			events.add = this._openTooltip;
		}
		this[onOff](events);
		this._tooltipHandlersAdded = !remove$$1;
	},

	// @method openTooltip(latlng?: LatLng): this
	// Opens the bound tooltip at the specified `latlng` or at the default tooltip anchor if no `latlng` is passed.
	openTooltip: function (layer, latlng) {
		if (this._tooltip && this._map) {
			latlng = this._tooltip._prepareOpen(this, layer, latlng);

			// open the tooltip on the map
			this._map.openTooltip(this._tooltip, latlng);

			// Tooltip container may not be defined if not permanent and never
			// opened.
			if (this._tooltip.options.interactive && this._tooltip._container) {
				addClass(this._tooltip._container, 'leaflet-clickable');
				this.addInteractiveTarget(this._tooltip._container);
			}
		}

		return this;
	},

	// @method closeTooltip(): this
	// Closes the tooltip bound to this layer if it is open.
	closeTooltip: function () {
		if (this._tooltip) {
			this._tooltip._close();
			if (this._tooltip.options.interactive && this._tooltip._container) {
				removeClass(this._tooltip._container, 'leaflet-clickable');
				this.removeInteractiveTarget(this._tooltip._container);
			}
		}
		return this;
	},

	// @method toggleTooltip(): this
	// Opens or closes the tooltip bound to this layer depending on its current state.
	toggleTooltip: function (target) {
		if (this._tooltip) {
			if (this._tooltip._map) {
				this.closeTooltip();
			} else {
				this.openTooltip(target);
			}
		}
		return this;
	},

	// @method isTooltipOpen(): boolean
	// Returns `true` if the tooltip bound to this layer is currently open.
	isTooltipOpen: function () {
		return this._tooltip.isOpen();
	},

	// @method setTooltipContent(content: String|HTMLElement|Tooltip): this
	// Sets the content of the tooltip bound to this layer.
	setTooltipContent: function (content) {
		if (this._tooltip) {
			this._tooltip.setContent(content);
		}
		return this;
	},

	// @method getTooltip(): Tooltip
	// Returns the tooltip bound to this layer.
	getTooltip: function () {
		return this._tooltip;
	},

	_openTooltip: function (e) {
		var layer = e.layer || e.target;

		if (!this._tooltip || !this._map) {
			return;
		}
		this.openTooltip(layer, this._tooltip.options.sticky ? e.latlng : undefined);
	},

	_moveTooltip: function (e) {
		var latlng = e.latlng, containerPoint, layerPoint;
		if (this._tooltip.options.sticky && e.originalEvent) {
			containerPoint = this._map.mouseEventToContainerPoint(e.originalEvent);
			layerPoint = this._map.containerPointToLayerPoint(containerPoint);
			latlng = this._map.layerPointToLatLng(layerPoint);
		}
		this._tooltip.setLatLng(latlng);
	}
});

/*
 * @class DivIcon
 * @aka L.DivIcon
 * @inherits Icon
 *
 * Represents a lightweight icon for markers that uses a simple `<div>`
 * element instead of an image. Inherits from `Icon` but ignores the `iconUrl` and shadow options.
 *
 * @example
 * ```js
 * var myIcon = L.divIcon({className: 'my-div-icon'});
 * // you can set .my-div-icon styles in CSS
 *
 * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * By default, it has a 'leaflet-div-icon' CSS class and is styled as a little white square with a shadow.
 */

var DivIcon = Icon.extend({
	options: {
		// @section
		// @aka DivIcon options
		iconSize: [12, 12], // also can be set through CSS

		// iconAnchor: (Point),
		// popupAnchor: (Point),

		// @option html: String|HTMLElement = ''
		// Custom HTML code to put inside the div element, empty by default. Alternatively,
		// an instance of `HTMLElement`.
		html: false,

		// @option bgPos: Point = [0, 0]
		// Optional relative position of the background, in pixels
		bgPos: null,

		className: 'leaflet-div-icon'
	},

	createIcon: function (oldIcon) {
		var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
		    options = this.options;

		if (options.html instanceof Element) {
			empty(div);
			div.appendChild(options.html);
		} else {
			div.innerHTML = options.html !== false ? options.html : '';
		}

		if (options.bgPos) {
			var bgPos = toPoint(options.bgPos);
			div.style.backgroundPosition = (-bgPos.x) + 'px ' + (-bgPos.y) + 'px';
		}
		this._setIconStyles(div, 'icon');

		return div;
	},

	createShadow: function () {
		return null;
	}
});

// @factory L.divIcon(options: DivIcon options)
// Creates a `DivIcon` instance with the given options.
function divIcon(options) {
	return new DivIcon(options);
}

Icon.Default = IconDefault;

/*
 * @class GridLayer
 * @inherits Layer
 * @aka L.GridLayer
 *
 * Generic class for handling a tiled grid of HTML elements. This is the base class for all tile layers and replaces `TileLayer.Canvas`.
 * GridLayer can be extended to create a tiled grid of HTML elements like `<canvas>`, `<img>` or `<div>`. GridLayer will handle creating and animating these DOM elements for you.
 *
 *
 * @section Synchronous usage
 * @example
 *
 * To create a custom layer, extend GridLayer and implement the `createTile()` method, which will be passed a `Point` object with the `x`, `y`, and `z` (zoom level) coordinates to draw your tile.
 *
 * ```js
 * var CanvasLayer = L.GridLayer.extend({
 *     createTile: function(coords){
 *         // create a <canvas> element for drawing
 *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
 *
 *         // setup tile width and height according to the options
 *         var size = this.getTileSize();
 *         tile.width = size.x;
 *         tile.height = size.y;
 *
 *         // get a canvas context and draw something on it using coords.x, coords.y and coords.z
 *         var ctx = tile.getContext('2d');
 *
 *         // return the tile so it can be rendered on screen
 *         return tile;
 *     }
 * });
 * ```
 *
 * @section Asynchronous usage
 * @example
 *
 * Tile creation can also be asynchronous, this is useful when using a third-party drawing library. Once the tile is finished drawing it can be passed to the `done()` callback.
 *
 * ```js
 * var CanvasLayer = L.GridLayer.extend({
 *     createTile: function(coords, done){
 *         var error;
 *
 *         // create a <canvas> element for drawing
 *         var tile = L.DomUtil.create('canvas', 'leaflet-tile');
 *
 *         // setup tile width and height according to the options
 *         var size = this.getTileSize();
 *         tile.width = size.x;
 *         tile.height = size.y;
 *
 *         // draw something asynchronously and pass the tile to the done() callback
 *         setTimeout(function() {
 *             done(error, tile);
 *         }, 1000);
 *
 *         return tile;
 *     }
 * });
 * ```
 *
 * @section
 */


var GridLayer = Layer.extend({

	// @section
	// @aka GridLayer options
	options: {
		// @option tileSize: Number|Point = 256
		// Width and height of tiles in the grid. Use a number if width and height are equal, or `L.point(width, height)` otherwise.
		tileSize: 256,

		// @option opacity: Number = 1.0
		// Opacity of the tiles. Can be used in the `createTile()` function.
		opacity: 1,

		// @option updateWhenIdle: Boolean = (depends)
		// Load new tiles only when panning ends.
		// `true` by default on mobile browsers, in order to avoid too many requests and keep smooth navigation.
		// `false` otherwise in order to display new tiles _during_ panning, since it is easy to pan outside the
		// [`keepBuffer`](#gridlayer-keepbuffer) option in desktop browsers.
		updateWhenIdle: mobile,

		// @option updateWhenZooming: Boolean = true
		// By default, a smooth zoom animation (during a [touch zoom](#map-touchzoom) or a [`flyTo()`](#map-flyto)) will update grid layers every integer zoom level. Setting this option to `false` will update the grid layer only when the smooth animation ends.
		updateWhenZooming: true,

		// @option updateInterval: Number = 200
		// Tiles will not update more than once every `updateInterval` milliseconds when panning.
		updateInterval: 200,

		// @option zIndex: Number = 1
		// The explicit zIndex of the tile layer.
		zIndex: 1,

		// @option bounds: LatLngBounds = undefined
		// If set, tiles will only be loaded inside the set `LatLngBounds`.
		bounds: null,

		// @option minZoom: Number = 0
		// The minimum zoom level down to which this layer will be displayed (inclusive).
		minZoom: 0,

		// @option maxZoom: Number = undefined
		// The maximum zoom level up to which this layer will be displayed (inclusive).
		maxZoom: undefined,

		// @option maxNativeZoom: Number = undefined
		// Maximum zoom number the tile source has available. If it is specified,
		// the tiles on all zoom levels higher than `maxNativeZoom` will be loaded
		// from `maxNativeZoom` level and auto-scaled.
		maxNativeZoom: undefined,

		// @option minNativeZoom: Number = undefined
		// Minimum zoom number the tile source has available. If it is specified,
		// the tiles on all zoom levels lower than `minNativeZoom` will be loaded
		// from `minNativeZoom` level and auto-scaled.
		minNativeZoom: undefined,

		// @option noWrap: Boolean = false
		// Whether the layer is wrapped around the antimeridian. If `true`, the
		// GridLayer will only be displayed once at low zoom levels. Has no
		// effect when the [map CRS](#map-crs) doesn't wrap around. Can be used
		// in combination with [`bounds`](#gridlayer-bounds) to prevent requesting
		// tiles outside the CRS limits.
		noWrap: false,

		// @option pane: String = 'tilePane'
		// `Map pane` where the grid layer will be added.
		pane: 'tilePane',

		// @option className: String = ''
		// A custom class name to assign to the tile layer. Empty by default.
		className: '',

		// @option keepBuffer: Number = 2
		// When panning the map, keep this many rows and columns of tiles before unloading them.
		keepBuffer: 2
	},

	initialize: function (options) {
		setOptions(this, options);
	},

	onAdd: function () {
		this._initContainer();

		this._levels = {};
		this._tiles = {};

		this._resetView();
		this._update();
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
	},

	onRemove: function (map) {
		this._removeAllTiles();
		remove(this._container);
		map._removeZoomLimit(this);
		this._container = null;
		this._tileZoom = undefined;
	},

	// @method bringToFront: this
	// Brings the tile layer to the top of all tile layers.
	bringToFront: function () {
		if (this._map) {
			toFront(this._container);
			this._setAutoZIndex(Math.max);
		}
		return this;
	},

	// @method bringToBack: this
	// Brings the tile layer to the bottom of all tile layers.
	bringToBack: function () {
		if (this._map) {
			toBack(this._container);
			this._setAutoZIndex(Math.min);
		}
		return this;
	},

	// @method getContainer: HTMLElement
	// Returns the HTML element that contains the tiles for this layer.
	getContainer: function () {
		return this._container;
	},

	// @method setOpacity(opacity: Number): this
	// Changes the [opacity](#gridlayer-opacity) of the grid layer.
	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	},

	// @method setZIndex(zIndex: Number): this
	// Changes the [zIndex](#gridlayer-zindex) of the grid layer.
	setZIndex: function (zIndex) {
		this.options.zIndex = zIndex;
		this._updateZIndex();

		return this;
	},

	// @method isLoading: Boolean
	// Returns `true` if any tile in the grid layer has not finished loading.
	isLoading: function () {
		return this._loading;
	},

	// @method redraw: this
	// Causes the layer to clear all the tiles and request them again.
	redraw: function () {
		if (this._map) {
			this._removeAllTiles();
			this._update();
		}
		return this;
	},

	getEvents: function () {
		var events = {
			viewprereset: this._invalidateAll,
			viewreset: this._resetView,
			zoom: this._resetView,
			moveend: this._onMoveEnd
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			if (!this._onMove) {
				this._onMove = throttle(this._onMoveEnd, this.options.updateInterval, this);
			}

			events.move = this._onMove;
		}

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	// @section Extension methods
	// Layers extending `GridLayer` shall reimplement the following method.
	// @method createTile(coords: Object, done?: Function): HTMLElement
	// Called only internally, must be overridden by classes extending `GridLayer`.
	// Returns the `HTMLElement` corresponding to the given `coords`. If the `done` callback
	// is specified, it must be called when the tile has finished loading and drawing.
	createTile: function () {
		return document.createElement('div');
	},

	// @section
	// @method getTileSize: Point
	// Normalizes the [tileSize option](#gridlayer-tilesize) into a point. Used by the `createTile()` method.
	getTileSize: function () {
		var s = this.options.tileSize;
		return s instanceof Point ? s : new Point(s, s);
	},

	_updateZIndex: function () {
		if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._container.style.zIndex = this.options.zIndex;
		}
	},

	_setAutoZIndex: function (compare) {
		// go through all other layers of the same pane, set zIndex to max + 1 (front) or min - 1 (back)

		var layers = this.getPane().children,
		    edgeZIndex = -compare(-Infinity, Infinity); // -Infinity for max, Infinity for min

		for (var i = 0, len = layers.length, zIndex; i < len; i++) {

			zIndex = layers[i].style.zIndex;

			if (layers[i] !== this._container && zIndex) {
				edgeZIndex = compare(edgeZIndex, +zIndex);
			}
		}

		if (isFinite(edgeZIndex)) {
			this.options.zIndex = edgeZIndex + compare(-1, 1);
			this._updateZIndex();
		}
	},

	_updateOpacity: function () {
		if (!this._map) { return; }

		// IE doesn't inherit filter opacity properly, so we're forced to set it on tiles
		if (ielt9) { return; }

		setOpacity(this._container, this.options.opacity);

		var now = +new Date(),
		    nextFrame = false,
		    willPrune = false;

		for (var key in this._tiles) {
			var tile = this._tiles[key];
			if (!tile.current || !tile.loaded) { continue; }

			var fade = Math.min(1, (now - tile.loaded) / 200);

			setOpacity(tile.el, fade);
			if (fade < 1) {
				nextFrame = true;
			} else {
				if (tile.active) {
					willPrune = true;
				} else {
					this._onOpaqueTile(tile);
				}
				tile.active = true;
			}
		}

		if (willPrune && !this._noPrune) { this._pruneTiles(); }

		if (nextFrame) {
			cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
		}
	},

	_onOpaqueTile: falseFn,

	_initContainer: function () {
		if (this._container) { return; }

		this._container = create$1('div', 'leaflet-layer ' + (this.options.className || ''));
		this._updateZIndex();

		if (this.options.opacity < 1) {
			this._updateOpacity();
		}

		this.getPane().appendChild(this._container);
	},

	_updateLevels: function () {

		var zoom = this._tileZoom,
		    maxZoom = this.options.maxZoom;

		if (zoom === undefined) { return undefined; }

		for (var z in this._levels) {
			if (this._levels[z].el.children.length || z === zoom) {
				this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
				this._onUpdateLevel(z);
			} else {
				remove(this._levels[z].el);
				this._removeTilesAtZoom(z);
				this._onRemoveLevel(z);
				delete this._levels[z];
			}
		}

		var level = this._levels[zoom],
		    map = this._map;

		if (!level) {
			level = this._levels[zoom] = {};

			level.el = create$1('div', 'leaflet-tile-container leaflet-zoom-animated', this._container);
			level.el.style.zIndex = maxZoom;

			level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
			level.zoom = zoom;

			this._setZoomTransform(level, map.getCenter(), map.getZoom());

			// force the browser to consider the newly added element for transition
			falseFn(level.el.offsetWidth);

			this._onCreateLevel(level);
		}

		this._level = level;

		return level;
	},

	_onUpdateLevel: falseFn,

	_onRemoveLevel: falseFn,

	_onCreateLevel: falseFn,

	_pruneTiles: function () {
		if (!this._map) {
			return;
		}

		var key, tile;

		var zoom = this._map.getZoom();
		if (zoom > this.options.maxZoom ||
			zoom < this.options.minZoom) {
			this._removeAllTiles();
			return;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			tile.retain = tile.current;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			if (tile.current && !tile.active) {
				var coords = tile.coords;
				if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
					this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
				}
			}
		}

		for (key in this._tiles) {
			if (!this._tiles[key].retain) {
				this._removeTile(key);
			}
		}
	},

	_removeTilesAtZoom: function (zoom) {
		for (var key in this._tiles) {
			if (this._tiles[key].coords.z !== zoom) {
				continue;
			}
			this._removeTile(key);
		}
	},

	_removeAllTiles: function () {
		for (var key in this._tiles) {
			this._removeTile(key);
		}
	},

	_invalidateAll: function () {
		for (var z in this._levels) {
			remove(this._levels[z].el);
			this._onRemoveLevel(z);
			delete this._levels[z];
		}
		this._removeAllTiles();

		this._tileZoom = undefined;
	},

	_retainParent: function (x, y, z, minZoom) {
		var x2 = Math.floor(x / 2),
		    y2 = Math.floor(y / 2),
		    z2 = z - 1,
		    coords2 = new Point(+x2, +y2);
		coords2.z = +z2;

		var key = this._tileCoordsToKey(coords2),
		    tile = this._tiles[key];

		if (tile && tile.active) {
			tile.retain = true;
			return true;

		} else if (tile && tile.loaded) {
			tile.retain = true;
		}

		if (z2 > minZoom) {
			return this._retainParent(x2, y2, z2, minZoom);
		}

		return false;
	},

	_retainChildren: function (x, y, z, maxZoom) {

		for (var i = 2 * x; i < 2 * x + 2; i++) {
			for (var j = 2 * y; j < 2 * y + 2; j++) {

				var coords = new Point(i, j);
				coords.z = z + 1;

				var key = this._tileCoordsToKey(coords),
				    tile = this._tiles[key];

				if (tile && tile.active) {
					tile.retain = true;
					continue;

				} else if (tile && tile.loaded) {
					tile.retain = true;
				}

				if (z + 1 < maxZoom) {
					this._retainChildren(i, j, z + 1, maxZoom);
				}
			}
		}
	},

	_resetView: function (e) {
		var animating = e && (e.pinch || e.flyTo);
		this._setView(this._map.getCenter(), this._map.getZoom(), animating, animating);
	},

	_animateZoom: function (e) {
		this._setView(e.center, e.zoom, true, e.noUpdate);
	},

	_clampZoom: function (zoom) {
		var options = this.options;

		if (undefined !== options.minNativeZoom && zoom < options.minNativeZoom) {
			return options.minNativeZoom;
		}

		if (undefined !== options.maxNativeZoom && options.maxNativeZoom < zoom) {
			return options.maxNativeZoom;
		}

		return zoom;
	},

	_setView: function (center, zoom, noPrune, noUpdate) {
		var tileZoom = this._clampZoom(Math.round(zoom));
		if ((this.options.maxZoom !== undefined && tileZoom > this.options.maxZoom) ||
		    (this.options.minZoom !== undefined && tileZoom < this.options.minZoom)) {
			tileZoom = undefined;
		}

		var tileZoomChanged = this.options.updateWhenZooming && (tileZoom !== this._tileZoom);

		if (!noUpdate || tileZoomChanged) {

			this._tileZoom = tileZoom;

			if (this._abortLoading) {
				this._abortLoading();
			}

			this._updateLevels();
			this._resetGrid();

			if (tileZoom !== undefined) {
				this._update(center);
			}

			if (!noPrune) {
				this._pruneTiles();
			}

			// Flag to prevent _updateOpacity from pruning tiles during
			// a zoom anim or a pinch gesture
			this._noPrune = !!noPrune;
		}

		this._setZoomTransforms(center, zoom);
	},

	_setZoomTransforms: function (center, zoom) {
		for (var i in this._levels) {
			this._setZoomTransform(this._levels[i], center, zoom);
		}
	},

	_setZoomTransform: function (level, center, zoom) {
		var scale = this._map.getZoomScale(zoom, level.zoom),
		    translate = level.origin.multiplyBy(scale)
		        .subtract(this._map._getNewPixelOrigin(center, zoom)).round();

		if (any3d) {
			setTransform(level.el, translate, scale);
		} else {
			setPosition(level.el, translate);
		}
	},

	_resetGrid: function () {
		var map = this._map,
		    crs = map.options.crs,
		    tileSize = this._tileSize = this.getTileSize(),
		    tileZoom = this._tileZoom;

		var bounds = this._map.getPixelWorldBounds(this._tileZoom);
		if (bounds) {
			this._globalTileRange = this._pxBoundsToTileRange(bounds);
		}

		this._wrapX = crs.wrapLng && !this.options.noWrap && [
			Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize.x),
			Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize.y)
		];
		this._wrapY = crs.wrapLat && !this.options.noWrap && [
			Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize.x),
			Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize.y)
		];
	},

	_onMoveEnd: function () {
		if (!this._map || this._map._animatingZoom) { return; }

		this._update();
	},

	_getTiledPixelBounds: function (center) {
		var map = this._map,
		    mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom(),
		    scale = map.getZoomScale(mapZoom, this._tileZoom),
		    pixelCenter = map.project(center, this._tileZoom).floor(),
		    halfSize = map.getSize().divideBy(scale * 2);

		return new Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
	},

	// Private method to load tiles in the grid's active zoom level according to map bounds
	_update: function (center) {
		var map = this._map;
		if (!map) { return; }
		var zoom = this._clampZoom(map.getZoom());

		if (center === undefined) { center = map.getCenter(); }
		if (this._tileZoom === undefined) { return; }	// if out of minzoom/maxzoom

		var pixelBounds = this._getTiledPixelBounds(center),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    tileCenter = tileRange.getCenter(),
		    queue = [],
		    margin = this.options.keepBuffer,
		    noPruneRange = new Bounds(tileRange.getBottomLeft().subtract([margin, -margin]),
		                              tileRange.getTopRight().add([margin, -margin]));

		// Sanity check: panic if the tile range contains Infinity somewhere.
		if (!(isFinite(tileRange.min.x) &&
		      isFinite(tileRange.min.y) &&
		      isFinite(tileRange.max.x) &&
		      isFinite(tileRange.max.y))) { throw new Error('Attempted to load an infinite number of tiles'); }

		for (var key in this._tiles) {
			var c = this._tiles[key].coords;
			if (c.z !== this._tileZoom || !noPruneRange.contains(new Point(c.x, c.y))) {
				this._tiles[key].current = false;
			}
		}

		// _update just loads more tiles. If the tile zoom level differs too much
		// from the map's, let _setView reset levels and prune old tiles.
		if (Math.abs(zoom - this._tileZoom) > 1) { this._setView(center, zoom); return; }

		// create a queue of coordinates to load tiles from
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				var coords = new Point(i, j);
				coords.z = this._tileZoom;

				if (!this._isValidTile(coords)) { continue; }

				var tile = this._tiles[this._tileCoordsToKey(coords)];
				if (tile) {
					tile.current = true;
				} else {
					queue.push(coords);
				}
			}
		}

		// sort tile queue to load tiles in order of their distance to center
		queue.sort(function (a, b) {
			return a.distanceTo(tileCenter) - b.distanceTo(tileCenter);
		});

		if (queue.length !== 0) {
			// if it's the first batch of tiles to load
			if (!this._loading) {
				this._loading = true;
				// @event loading: Event
				// Fired when the grid layer starts loading tiles.
				this.fire('loading');
			}

			// create DOM fragment to append tiles in one batch
			var fragment = document.createDocumentFragment();

			for (i = 0; i < queue.length; i++) {
				this._addTile(queue[i], fragment);
			}

			this._level.el.appendChild(fragment);
		}
	},

	_isValidTile: function (coords) {
		var crs = this._map.options.crs;

		if (!crs.infinite) {
			// don't load tile if it's out of bounds and not wrapped
			var bounds = this._globalTileRange;
			if ((!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x)) ||
			    (!crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y))) { return false; }
		}

		if (!this.options.bounds) { return true; }

		// don't load tile if it doesn't intersect the bounds in options
		var tileBounds = this._tileCoordsToBounds(coords);
		return toLatLngBounds(this.options.bounds).overlaps(tileBounds);
	},

	_keyToBounds: function (key) {
		return this._tileCoordsToBounds(this._keyToTileCoords(key));
	},

	_tileCoordsToNwSe: function (coords) {
		var map = this._map,
		    tileSize = this.getTileSize(),
		    nwPoint = coords.scaleBy(tileSize),
		    sePoint = nwPoint.add(tileSize),
		    nw = map.unproject(nwPoint, coords.z),
		    se = map.unproject(sePoint, coords.z);
		return [nw, se];
	},

	// converts tile coordinates to its geographical bounds
	_tileCoordsToBounds: function (coords) {
		var bp = this._tileCoordsToNwSe(coords),
		    bounds = new LatLngBounds(bp[0], bp[1]);

		if (!this.options.noWrap) {
			bounds = this._map.wrapLatLngBounds(bounds);
		}
		return bounds;
	},
	// converts tile coordinates to key for the tile cache
	_tileCoordsToKey: function (coords) {
		return coords.x + ':' + coords.y + ':' + coords.z;
	},

	// converts tile cache key to coordinates
	_keyToTileCoords: function (key) {
		var k = key.split(':'),
		    coords = new Point(+k[0], +k[1]);
		coords.z = +k[2];
		return coords;
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile) { return; }

		remove(tile.el);

		delete this._tiles[key];

		// @event tileunload: TileEvent
		// Fired when a tile is removed (e.g. when a tile goes off the screen).
		this.fire('tileunload', {
			tile: tile.el,
			coords: this._keyToTileCoords(key)
		});
	},

	_initTile: function (tile) {
		addClass(tile, 'leaflet-tile');

		var tileSize = this.getTileSize();
		tile.style.width = tileSize.x + 'px';
		tile.style.height = tileSize.y + 'px';

		tile.onselectstart = falseFn;
		tile.onmousemove = falseFn;

		// update opacity on tiles in IE7-8 because of filter inheritance problems
		if (ielt9 && this.options.opacity < 1) {
			setOpacity(tile, this.options.opacity);
		}

		// without this hack, tiles disappear after zoom on Chrome for Android
		// https://github.com/Leaflet/Leaflet/issues/2078
		if (android && !android23) {
			tile.style.WebkitBackfaceVisibility = 'hidden';
		}
	},

	_addTile: function (coords, container) {
		var tilePos = this._getTilePos(coords),
		    key = this._tileCoordsToKey(coords);

		var tile = this.createTile(this._wrapCoords(coords), bind(this._tileReady, this, coords));

		this._initTile(tile);

		// if createTile is defined with a second argument ("done" callback),
		// we know that tile is async and will be ready later; otherwise
		if (this.createTile.length < 2) {
			// mark tile as ready, but delay one frame for opacity animation to happen
			requestAnimFrame(bind(this._tileReady, this, coords, null, tile));
		}

		setPosition(tile, tilePos);

		// save tile in cache
		this._tiles[key] = {
			el: tile,
			coords: coords,
			current: true
		};

		container.appendChild(tile);
		// @event tileloadstart: TileEvent
		// Fired when a tile is requested and starts loading.
		this.fire('tileloadstart', {
			tile: tile,
			coords: coords
		});
	},

	_tileReady: function (coords, err, tile) {
		if (err) {
			// @event tileerror: TileErrorEvent
			// Fired when there is an error loading a tile.
			this.fire('tileerror', {
				error: err,
				tile: tile,
				coords: coords
			});
		}

		var key = this._tileCoordsToKey(coords);

		tile = this._tiles[key];
		if (!tile) { return; }

		tile.loaded = +new Date();
		if (this._map._fadeAnimated) {
			setOpacity(tile.el, 0);
			cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
		} else {
			tile.active = true;
			this._pruneTiles();
		}

		if (!err) {
			addClass(tile.el, 'leaflet-tile-loaded');

			// @event tileload: TileEvent
			// Fired when a tile loads.
			this.fire('tileload', {
				tile: tile.el,
				coords: coords
			});
		}

		if (this._noTilesToLoad()) {
			this._loading = false;
			// @event load: Event
			// Fired when the grid layer loaded all visible tiles.
			this.fire('load');

			if (ielt9 || !this._map._fadeAnimated) {
				requestAnimFrame(this._pruneTiles, this);
			} else {
				// Wait a bit more than 0.2 secs (the duration of the tile fade-in)
				// to trigger a pruning.
				setTimeout(bind(this._pruneTiles, this), 250);
			}
		}
	},

	_getTilePos: function (coords) {
		return coords.scaleBy(this.getTileSize()).subtract(this._level.origin);
	},

	_wrapCoords: function (coords) {
		var newCoords = new Point(
			this._wrapX ? wrapNum(coords.x, this._wrapX) : coords.x,
			this._wrapY ? wrapNum(coords.y, this._wrapY) : coords.y);
		newCoords.z = coords.z;
		return newCoords;
	},

	_pxBoundsToTileRange: function (bounds) {
		var tileSize = this.getTileSize();
		return new Bounds(
			bounds.min.unscaleBy(tileSize).floor(),
			bounds.max.unscaleBy(tileSize).ceil().subtract([1, 1]));
	},

	_noTilesToLoad: function () {
		for (var key in this._tiles) {
			if (!this._tiles[key].loaded) { return false; }
		}
		return true;
	}
});

// @factory L.gridLayer(options?: GridLayer options)
// Creates a new instance of GridLayer with the supplied options.
function gridLayer(options) {
	return new GridLayer(options);
}

/*
 * @class TileLayer
 * @inherits GridLayer
 * @aka L.TileLayer
 * Used to load and display tile layers on the map. Note that most tile servers require attribution, which you can set under `Layer`. Extends `GridLayer`.
 *
 * @example
 *
 * ```js
 * L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', {foo: 'bar', attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'}).addTo(map);
 * ```
 *
 * @section URL template
 * @example
 *
 * A string of the following form:
 *
 * ```
 * 'http://{s}.somedomain.com/blabla/{z}/{x}/{y}{r}.png'
 * ```
 *
 * `{s}` means one of the available subdomains (used sequentially to help with browser parallel requests per domain limitation; subdomain values are specified in options; `a`, `b` or `c` by default, can be omitted), `{z}` — zoom level, `{x}` and `{y}` — tile coordinates. `{r}` can be used to add "&commat;2x" to the URL to load retina tiles.
 *
 * You can use custom keys in the template, which will be [evaluated](#util-template) from TileLayer options, like this:
 *
 * ```
 * L.tileLayer('http://{s}.somedomain.com/{foo}/{z}/{x}/{y}.png', {foo: 'bar'});
 * ```
 */


var TileLayer = GridLayer.extend({

	// @section
	// @aka TileLayer options
	options: {
		// @option minZoom: Number = 0
		// The minimum zoom level down to which this layer will be displayed (inclusive).
		minZoom: 0,

		// @option maxZoom: Number = 18
		// The maximum zoom level up to which this layer will be displayed (inclusive).
		maxZoom: 18,

		// @option subdomains: String|String[] = 'abc'
		// Subdomains of the tile service. Can be passed in the form of one string (where each letter is a subdomain name) or an array of strings.
		subdomains: 'abc',

		// @option errorTileUrl: String = ''
		// URL to the tile image to show in place of the tile that failed to load.
		errorTileUrl: '',

		// @option zoomOffset: Number = 0
		// The zoom number used in tile URLs will be offset with this value.
		zoomOffset: 0,

		// @option tms: Boolean = false
		// If `true`, inverses Y axis numbering for tiles (turn this on for [TMS](https://en.wikipedia.org/wiki/Tile_Map_Service) services).
		tms: false,

		// @option zoomReverse: Boolean = false
		// If set to true, the zoom number used in tile URLs will be reversed (`maxZoom - zoom` instead of `zoom`)
		zoomReverse: false,

		// @option detectRetina: Boolean = false
		// If `true` and user is on a retina display, it will request four tiles of half the specified size and a bigger zoom level in place of one to utilize the high resolution.
		detectRetina: false,

		// @option crossOrigin: Boolean|String = false
		// Whether the crossOrigin attribute will be added to the tiles.
		// If a String is provided, all tiles will have their crossOrigin attribute set to the String provided. This is needed if you want to access tile pixel data.
		// Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
		crossOrigin: false
	},

	initialize: function (url, options) {

		this._url = url;

		options = setOptions(this, options);

		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && retina && options.maxZoom > 0) {

			options.tileSize = Math.floor(options.tileSize / 2);

			if (!options.zoomReverse) {
				options.zoomOffset++;
				options.maxZoom--;
			} else {
				options.zoomOffset--;
				options.minZoom++;
			}

			options.minZoom = Math.max(0, options.minZoom);
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}

		// for https://github.com/Leaflet/Leaflet/issues/137
		if (!android) {
			this.on('tileunload', this._onTileRemove);
		}
	},

	// @method setUrl(url: String, noRedraw?: Boolean): this
	// Updates the layer's URL template and redraws it (unless `noRedraw` is set to `true`).
	// If the URL does not change, the layer will not be redrawn unless
	// the noRedraw parameter is set to false.
	setUrl: function (url, noRedraw) {
		if (this._url === url && noRedraw === undefined) {
			noRedraw = true;
		}

		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	// @method createTile(coords: Object, done?: Function): HTMLElement
	// Called only internally, overrides GridLayer's [`createTile()`](#gridlayer-createtile)
	// to return an `<img>` HTML element with the appropriate image URL given `coords`. The `done`
	// callback is called when the tile has been loaded.
	createTile: function (coords, done) {
		var tile = document.createElement('img');

		on(tile, 'load', bind(this._tileOnLoad, this, done, tile));
		on(tile, 'error', bind(this._tileOnError, this, done, tile));

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
		}

		/*
		 Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
		 http://www.w3.org/TR/WCAG20-TECHS/H67
		*/
		tile.alt = '';

		/*
		 Set role="presentation" to force screen readers to ignore this
		 https://www.w3.org/TR/wai-aria/roles#textalternativecomputation
		*/
		tile.setAttribute('role', 'presentation');

		tile.src = this.getTileUrl(coords);

		return tile;
	},

	// @section Extension methods
	// @uninheritable
	// Layers extending `TileLayer` might reimplement the following method.
	// @method getTileUrl(coords: Object): String
	// Called only internally, returns the URL for a tile given its coordinates.
	// Classes extending `TileLayer` can override this function to provide custom tile URL naming schemes.
	getTileUrl: function (coords) {
		var data = {
			r: retina ? '@2x' : '',
			s: this._getSubdomain(coords),
			x: coords.x,
			y: coords.y,
			z: this._getZoomForUrl()
		};
		if (this._map && !this._map.options.crs.infinite) {
			var invertedY = this._globalTileRange.max.y - coords.y;
			if (this.options.tms) {
				data['y'] = invertedY;
			}
			data['-y'] = invertedY;
		}

		return template(this._url, extend(data, this.options));
	},

	_tileOnLoad: function (done, tile) {
		// For https://github.com/Leaflet/Leaflet/issues/3332
		if (ielt9) {
			setTimeout(bind(done, this, null, tile), 0);
		} else {
			done(null, tile);
		}
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl && tile.getAttribute('src') !== errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_getZoomForUrl: function () {
		var zoom = this._tileZoom,
		maxZoom = this.options.maxZoom,
		zoomReverse = this.options.zoomReverse,
		zoomOffset = this.options.zoomOffset;

		if (zoomReverse) {
			zoom = maxZoom - zoom;
		}

		return zoom + zoomOffset;
	},

	_getSubdomain: function (tilePoint) {
		var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		return this.options.subdomains[index];
	},

	// stops loading all tiles in the background layer
	_abortLoading: function () {
		var i, tile;
		for (i in this._tiles) {
			if (this._tiles[i].coords.z !== this._tileZoom) {
				tile = this._tiles[i].el;

				tile.onload = falseFn;
				tile.onerror = falseFn;

				if (!tile.complete) {
					tile.src = emptyImageUrl;
					remove(tile);
					delete this._tiles[i];
				}
			}
		}
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile) { return; }

		// Cancels any pending http requests associated with the tile
		// unless we're on Android's stock browser,
		// see https://github.com/Leaflet/Leaflet/issues/137
		if (!androidStock) {
			tile.el.setAttribute('src', emptyImageUrl);
		}

		return GridLayer.prototype._removeTile.call(this, key);
	},

	_tileReady: function (coords, err, tile) {
		if (!this._map || (tile && tile.getAttribute('src') === emptyImageUrl)) {
			return;
		}

		return GridLayer.prototype._tileReady.call(this, coords, err, tile);
	}
});


// @factory L.tilelayer(urlTemplate: String, options?: TileLayer options)
// Instantiates a tile layer object given a `URL template` and optionally an options object.

function tileLayer(url, options) {
	return new TileLayer(url, options);
}

/*
 * @class TileLayer.WMS
 * @inherits TileLayer
 * @aka L.TileLayer.WMS
 * Used to display [WMS](https://en.wikipedia.org/wiki/Web_Map_Service) services as tile layers on the map. Extends `TileLayer`.
 *
 * @example
 *
 * ```js
 * var nexrad = L.tileLayer.wms("http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi", {
 * 	layers: 'nexrad-n0r-900913',
 * 	format: 'image/png',
 * 	transparent: true,
 * 	attribution: "Weather data © 2012 IEM Nexrad"
 * });
 * ```
 */

var TileLayerWMS = TileLayer.extend({

	// @section
	// @aka TileLayer.WMS options
	// If any custom options not documented here are used, they will be sent to the
	// WMS server as extra parameters in each request URL. This can be useful for
	// [non-standard vendor WMS parameters](http://docs.geoserver.org/stable/en/user/services/wms/vendor.html).
	defaultWmsParams: {
		service: 'WMS',
		request: 'GetMap',

		// @option layers: String = ''
		// **(required)** Comma-separated list of WMS layers to show.
		layers: '',

		// @option styles: String = ''
		// Comma-separated list of WMS styles.
		styles: '',

		// @option format: String = 'image/jpeg'
		// WMS image format (use `'image/png'` for layers with transparency).
		format: 'image/jpeg',

		// @option transparent: Boolean = false
		// If `true`, the WMS service will return images with transparency.
		transparent: false,

		// @option version: String = '1.1.1'
		// Version of the WMS service to use
		version: '1.1.1'
	},

	options: {
		// @option crs: CRS = null
		// Coordinate Reference System to use for the WMS requests, defaults to
		// map CRS. Don't change this if you're not sure what it means.
		crs: null,

		// @option uppercase: Boolean = false
		// If `true`, WMS request parameter keys will be uppercase.
		uppercase: false
	},

	initialize: function (url, options) {

		this._url = url;

		var wmsParams = extend({}, this.defaultWmsParams);

		// all keys that are not TileLayer options go to WMS params
		for (var i in options) {
			if (!(i in this.options)) {
				wmsParams[i] = options[i];
			}
		}

		options = setOptions(this, options);

		var realRetina = options.detectRetina && retina ? 2 : 1;
		var tileSize = this.getTileSize();
		wmsParams.width = tileSize.x * realRetina;
		wmsParams.height = tileSize.y * realRetina;

		this.wmsParams = wmsParams;
	},

	onAdd: function (map) {

		this._crs = this.options.crs || map.options.crs;
		this._wmsVersion = parseFloat(this.wmsParams.version);

		var projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
		this.wmsParams[projectionKey] = this._crs.code;

		TileLayer.prototype.onAdd.call(this, map);
	},

	getTileUrl: function (coords) {

		var tileBounds = this._tileCoordsToNwSe(coords),
		    crs = this._crs,
		    bounds = toBounds(crs.project(tileBounds[0]), crs.project(tileBounds[1])),
		    min = bounds.min,
		    max = bounds.max,
		    bbox = (this._wmsVersion >= 1.3 && this._crs === EPSG4326 ?
		    [min.y, min.x, max.y, max.x] :
		    [min.x, min.y, max.x, max.y]).join(','),
		    url = TileLayer.prototype.getTileUrl.call(this, coords);
		return url +
			getParamString(this.wmsParams, url, this.options.uppercase) +
			(this.options.uppercase ? '&BBOX=' : '&bbox=') + bbox;
	},

	// @method setParams(params: Object, noRedraw?: Boolean): this
	// Merges an object with the new parameters and re-requests tiles on the current screen (unless `noRedraw` was set to true).
	setParams: function (params, noRedraw) {

		extend(this.wmsParams, params);

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	}
});


// @factory L.tileLayer.wms(baseUrl: String, options: TileLayer.WMS options)
// Instantiates a WMS tile layer object given a base URL of the WMS service and a WMS parameters/options object.
function tileLayerWMS(url, options) {
	return new TileLayerWMS(url, options);
}

TileLayer.WMS = TileLayerWMS;
tileLayer.wms = tileLayerWMS;

/*
 * @class Renderer
 * @inherits Layer
 * @aka L.Renderer
 *
 * Base class for vector renderer implementations (`SVG`, `Canvas`). Handles the
 * DOM container of the renderer, its bounds, and its zoom animation.
 *
 * A `Renderer` works as an implicit layer group for all `Path`s - the renderer
 * itself can be added or removed to the map. All paths use a renderer, which can
 * be implicit (the map will decide the type of renderer and use it automatically)
 * or explicit (using the [`renderer`](#path-renderer) option of the path).
 *
 * Do not use this class directly, use `SVG` and `Canvas` instead.
 *
 * @event update: Event
 * Fired when the renderer updates its bounds, center and zoom, for example when
 * its map has moved
 */

var Renderer = Layer.extend({

	// @section
	// @aka Renderer options
	options: {
		// @option padding: Number = 0.1
		// How much to extend the clip area around the map view (relative to its size)
		// e.g. 0.1 would be 10% of map view in each direction
		padding: 0.1,

		// @option tolerance: Number = 0
		// How much to extend click tolerance round a path/object on the map
		tolerance : 0
	},

	initialize: function (options) {
		setOptions(this, options);
		stamp(this);
		this._layers = this._layers || {};
	},

	onAdd: function () {
		if (!this._container) {
			this._initContainer(); // defined by renderer implementations

			if (this._zoomAnimated) {
				addClass(this._container, 'leaflet-zoom-animated');
			}
		}

		this.getPane().appendChild(this._container);
		this._update();
		this.on('update', this._updatePaths, this);
	},

	onRemove: function () {
		this.off('update', this._updatePaths, this);
		this._destroyContainer();
	},

	getEvents: function () {
		var events = {
			viewreset: this._reset,
			zoom: this._onZoom,
			moveend: this._update,
			zoomend: this._onZoomEnd
		};
		if (this._zoomAnimated) {
			events.zoomanim = this._onAnimZoom;
		}
		return events;
	},

	_onAnimZoom: function (ev) {
		this._updateTransform(ev.center, ev.zoom);
	},

	_onZoom: function () {
		this._updateTransform(this._map.getCenter(), this._map.getZoom());
	},

	_updateTransform: function (center, zoom) {
		var scale = this._map.getZoomScale(zoom, this._zoom),
		    position = getPosition(this._container),
		    viewHalf = this._map.getSize().multiplyBy(0.5 + this.options.padding),
		    currentCenterPoint = this._map.project(this._center, zoom),
		    destCenterPoint = this._map.project(center, zoom),
		    centerOffset = destCenterPoint.subtract(currentCenterPoint),

		    topLeftOffset = viewHalf.multiplyBy(-scale).add(position).add(viewHalf).subtract(centerOffset);

		if (any3d) {
			setTransform(this._container, topLeftOffset, scale);
		} else {
			setPosition(this._container, topLeftOffset);
		}
	},

	_reset: function () {
		this._update();
		this._updateTransform(this._center, this._zoom);

		for (var id in this._layers) {
			this._layers[id]._reset();
		}
	},

	_onZoomEnd: function () {
		for (var id in this._layers) {
			this._layers[id]._project();
		}
	},

	_updatePaths: function () {
		for (var id in this._layers) {
			this._layers[id]._update();
		}
	},

	_update: function () {
		// Update pixel bounds of renderer container (for positioning/sizing/clipping later)
		// Subclasses are responsible of firing the 'update' event.
		var p = this.options.padding,
		    size = this._map.getSize(),
		    min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

		this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());

		this._center = this._map.getCenter();
		this._zoom = this._map.getZoom();
	}
});

/*
 * @class Canvas
 * @inherits Renderer
 * @aka L.Canvas
 *
 * Allows vector layers to be displayed with [`<canvas>`](https://developer.mozilla.org/docs/Web/API/Canvas_API).
 * Inherits `Renderer`.
 *
 * Due to [technical limitations](http://caniuse.com/#search=canvas), Canvas is not
 * available in all web browsers, notably IE8, and overlapping geometries might
 * not display properly in some edge cases.
 *
 * @example
 *
 * Use Canvas by default for all paths in the map:
 *
 * ```js
 * var map = L.map('map', {
 * 	renderer: L.canvas()
 * });
 * ```
 *
 * Use a Canvas renderer with extra padding for specific vector geometries:
 *
 * ```js
 * var map = L.map('map');
 * var myRenderer = L.canvas({ padding: 0.5 });
 * var line = L.polyline( coordinates, { renderer: myRenderer } );
 * var circle = L.circle( center, { renderer: myRenderer } );
 * ```
 */

var Canvas = Renderer.extend({
	getEvents: function () {
		var events = Renderer.prototype.getEvents.call(this);
		events.viewprereset = this._onViewPreReset;
		return events;
	},

	_onViewPreReset: function () {
		// Set a flag so that a viewprereset+moveend+viewreset only updates&redraws once
		this._postponeUpdatePaths = true;
	},

	onAdd: function () {
		Renderer.prototype.onAdd.call(this);

		// Redraw vectors since canvas is cleared upon removal,
		// in case of removing the renderer itself from the map.
		this._draw();
	},

	_initContainer: function () {
		var container = this._container = document.createElement('canvas');

		on(container, 'mousemove', throttle(this._onMouseMove, 32, this), this);
		on(container, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);
		on(container, 'mouseout', this._handleMouseOut, this);

		this._ctx = container.getContext('2d');
	},

	_destroyContainer: function () {
		cancelAnimFrame(this._redrawRequest);
		delete this._ctx;
		remove(this._container);
		off(this._container);
		delete this._container;
	},

	_updatePaths: function () {
		if (this._postponeUpdatePaths) { return; }

		var layer;
		this._redrawBounds = null;
		for (var id in this._layers) {
			layer = this._layers[id];
			layer._update();
		}
		this._redraw();
	},

	_update: function () {
		if (this._map._animatingZoom && this._bounds) { return; }

		Renderer.prototype._update.call(this);

		var b = this._bounds,
		    container = this._container,
		    size = b.getSize(),
		    m = retina ? 2 : 1;

		setPosition(container, b.min);

		// set canvas size (also clearing it); use double size on retina
		container.width = m * size.x;
		container.height = m * size.y;
		container.style.width = size.x + 'px';
		container.style.height = size.y + 'px';

		if (retina) {
			this._ctx.scale(2, 2);
		}

		// translate so we use the same path coordinates after canvas element moves
		this._ctx.translate(-b.min.x, -b.min.y);

		// Tell paths to redraw themselves
		this.fire('update');
	},

	_reset: function () {
		Renderer.prototype._reset.call(this);

		if (this._postponeUpdatePaths) {
			this._postponeUpdatePaths = false;
			this._updatePaths();
		}
	},

	_initPath: function (layer) {
		this._updateDashArray(layer);
		this._layers[stamp(layer)] = layer;

		var order = layer._order = {
			layer: layer,
			prev: this._drawLast,
			next: null
		};
		if (this._drawLast) { this._drawLast.next = order; }
		this._drawLast = order;
		this._drawFirst = this._drawFirst || this._drawLast;
	},

	_addPath: function (layer) {
		this._requestRedraw(layer);
	},

	_removePath: function (layer) {
		var order = layer._order;
		var next = order.next;
		var prev = order.prev;

		if (next) {
			next.prev = prev;
		} else {
			this._drawLast = prev;
		}
		if (prev) {
			prev.next = next;
		} else {
			this._drawFirst = next;
		}

		delete layer._order;

		delete this._layers[stamp(layer)];

		this._requestRedraw(layer);
	},

	_updatePath: function (layer) {
		// Redraw the union of the layer's old pixel
		// bounds and the new pixel bounds.
		this._extendRedrawBounds(layer);
		layer._project();
		layer._update();
		// The redraw will extend the redraw bounds
		// with the new pixel bounds.
		this._requestRedraw(layer);
	},

	_updateStyle: function (layer) {
		this._updateDashArray(layer);
		this._requestRedraw(layer);
	},

	_updateDashArray: function (layer) {
		if (typeof layer.options.dashArray === 'string') {
			var parts = layer.options.dashArray.split(/[, ]+/),
			    dashArray = [],
			    dashValue,
			    i;
			for (i = 0; i < parts.length; i++) {
				dashValue = Number(parts[i]);
				// Ignore dash array containing invalid lengths
				if (isNaN(dashValue)) { return; }
				dashArray.push(dashValue);
			}
			layer.options._dashArray = dashArray;
		} else {
			layer.options._dashArray = layer.options.dashArray;
		}
	},

	_requestRedraw: function (layer) {
		if (!this._map) { return; }

		this._extendRedrawBounds(layer);
		this._redrawRequest = this._redrawRequest || requestAnimFrame(this._redraw, this);
	},

	_extendRedrawBounds: function (layer) {
		if (layer._pxBounds) {
			var padding = (layer.options.weight || 0) + 1;
			this._redrawBounds = this._redrawBounds || new Bounds();
			this._redrawBounds.extend(layer._pxBounds.min.subtract([padding, padding]));
			this._redrawBounds.extend(layer._pxBounds.max.add([padding, padding]));
		}
	},

	_redraw: function () {
		this._redrawRequest = null;

		if (this._redrawBounds) {
			this._redrawBounds.min._floor();
			this._redrawBounds.max._ceil();
		}

		this._clear(); // clear layers in redraw bounds
		this._draw(); // draw layers

		this._redrawBounds = null;
	},

	_clear: function () {
		var bounds = this._redrawBounds;
		if (bounds) {
			var size = bounds.getSize();
			this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
		} else {
			this._ctx.clearRect(0, 0, this._container.width, this._container.height);
		}
	},

	_draw: function () {
		var layer, bounds = this._redrawBounds;
		this._ctx.save();
		if (bounds) {
			var size = bounds.getSize();
			this._ctx.beginPath();
			this._ctx.rect(bounds.min.x, bounds.min.y, size.x, size.y);
			this._ctx.clip();
		}

		this._drawing = true;

		for (var order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (!bounds || (layer._pxBounds && layer._pxBounds.intersects(bounds))) {
				layer._updatePath();
			}
		}

		this._drawing = false;

		this._ctx.restore();  // Restore state before clipping.
	},

	_updatePoly: function (layer, closed) {
		if (!this._drawing) { return; }

		var i, j, len2, p,
		    parts = layer._parts,
		    len = parts.length,
		    ctx = this._ctx;

		if (!len) { return; }

		ctx.beginPath();

		for (i = 0; i < len; i++) {
			for (j = 0, len2 = parts[i].length; j < len2; j++) {
				p = parts[i][j];
				ctx[j ? 'lineTo' : 'moveTo'](p.x, p.y);
			}
			if (closed) {
				ctx.closePath();
			}
		}

		this._fillStroke(ctx, layer);

		// TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
	},

	_updateCircle: function (layer) {

		if (!this._drawing || layer._empty()) { return; }

		var p = layer._point,
		    ctx = this._ctx,
		    r = Math.max(Math.round(layer._radius), 1),
		    s = (Math.max(Math.round(layer._radiusY), 1) || r) / r;

		if (s !== 1) {
			ctx.save();
			ctx.scale(1, s);
		}

		ctx.beginPath();
		ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);

		if (s !== 1) {
			ctx.restore();
		}

		this._fillStroke(ctx, layer);
	},

	_fillStroke: function (ctx, layer) {
		var options = layer.options;

		if (options.fill) {
			ctx.globalAlpha = options.fillOpacity;
			ctx.fillStyle = options.fillColor || options.color;
			ctx.fill(options.fillRule || 'evenodd');
		}

		if (options.stroke && options.weight !== 0) {
			if (ctx.setLineDash) {
				ctx.setLineDash(layer.options && layer.options._dashArray || []);
			}
			ctx.globalAlpha = options.opacity;
			ctx.lineWidth = options.weight;
			ctx.strokeStyle = options.color;
			ctx.lineCap = options.lineCap;
			ctx.lineJoin = options.lineJoin;
			ctx.stroke();
		}
	},

	// Canvas obviously doesn't have mouse events for individual drawn objects,
	// so we emulate that by calculating what's under the mouse on mousemove/click manually

	_onClick: function (e) {
		var point = this._map.mouseEventToLayerPoint(e), layer, clickedLayer;

		for (var order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (layer.options.interactive && layer._containsPoint(point) && !this._map._draggableMoved(layer)) {
				clickedLayer = layer;
			}
		}
		if (clickedLayer)  {
			fakeStop(e);
			this._fireEvent([clickedLayer], e);
		}
	},

	_onMouseMove: function (e) {
		if (!this._map || this._map.dragging.moving() || this._map._animatingZoom) { return; }

		var point = this._map.mouseEventToLayerPoint(e);
		this._handleMouseHover(e, point);
	},


	_handleMouseOut: function (e) {
		var layer = this._hoveredLayer;
		if (layer) {
			// if we're leaving the layer, fire mouseout
			removeClass(this._container, 'leaflet-interactive');
			this._fireEvent([layer], e, 'mouseout');
			this._hoveredLayer = null;
		}
	},

	_handleMouseHover: function (e, point) {
		var layer, candidateHoveredLayer;

		for (var order = this._drawFirst; order; order = order.next) {
			layer = order.layer;
			if (layer.options.interactive && layer._containsPoint(point)) {
				candidateHoveredLayer = layer;
			}
		}

		if (candidateHoveredLayer !== this._hoveredLayer) {
			this._handleMouseOut(e);

			if (candidateHoveredLayer) {
				addClass(this._container, 'leaflet-interactive'); // change cursor
				this._fireEvent([candidateHoveredLayer], e, 'mouseover');
				this._hoveredLayer = candidateHoveredLayer;
			}
		}

		if (this._hoveredLayer) {
			this._fireEvent([this._hoveredLayer], e);
		}
	},

	_fireEvent: function (layers, e, type) {
		this._map._fireDOMEvent(e, type || e.type, layers);
	},

	_bringToFront: function (layer) {
		var order = layer._order;

		if (!order) { return; }

		var next = order.next;
		var prev = order.prev;

		if (next) {
			next.prev = prev;
		} else {
			// Already last
			return;
		}
		if (prev) {
			prev.next = next;
		} else if (next) {
			// Update first entry unless this is the
			// single entry
			this._drawFirst = next;
		}

		order.prev = this._drawLast;
		this._drawLast.next = order;

		order.next = null;
		this._drawLast = order;

		this._requestRedraw(layer);
	},

	_bringToBack: function (layer) {
		var order = layer._order;

		if (!order) { return; }

		var next = order.next;
		var prev = order.prev;

		if (prev) {
			prev.next = next;
		} else {
			// Already first
			return;
		}
		if (next) {
			next.prev = prev;
		} else if (prev) {
			// Update last entry unless this is the
			// single entry
			this._drawLast = prev;
		}

		order.prev = null;

		order.next = this._drawFirst;
		this._drawFirst.prev = order;
		this._drawFirst = order;

		this._requestRedraw(layer);
	}
});

// @factory L.canvas(options?: Renderer options)
// Creates a Canvas renderer with the given options.
function canvas$1(options) {
	return canvas ? new Canvas(options) : null;
}

/*
 * Thanks to Dmitry Baranovsky and his Raphael library for inspiration!
 */


var vmlCreate = (function () {
	try {
		document.namespaces.add('lvml', 'urn:schemas-microsoft-com:vml');
		return function (name) {
			return document.createElement('<lvml:' + name + ' class="lvml">');
		};
	} catch (e) {
		return function (name) {
			return document.createElement('<' + name + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
		};
	}
})();


/*
 * @class SVG
 *
 *
 * VML was deprecated in 2012, which means VML functionality exists only for backwards compatibility
 * with old versions of Internet Explorer.
 */

// mixin to redefine some SVG methods to handle VML syntax which is similar but with some differences
var vmlMixin = {

	_initContainer: function () {
		this._container = create$1('div', 'leaflet-vml-container');
	},

	_update: function () {
		if (this._map._animatingZoom) { return; }
		Renderer.prototype._update.call(this);
		this.fire('update');
	},

	_initPath: function (layer) {
		var container = layer._container = vmlCreate('shape');

		addClass(container, 'leaflet-vml-shape ' + (this.options.className || ''));

		container.coordsize = '1 1';

		layer._path = vmlCreate('path');
		container.appendChild(layer._path);

		this._updateStyle(layer);
		this._layers[stamp(layer)] = layer;
	},

	_addPath: function (layer) {
		var container = layer._container;
		this._container.appendChild(container);

		if (layer.options.interactive) {
			layer.addInteractiveTarget(container);
		}
	},

	_removePath: function (layer) {
		var container = layer._container;
		remove(container);
		layer.removeInteractiveTarget(container);
		delete this._layers[stamp(layer)];
	},

	_updateStyle: function (layer) {
		var stroke = layer._stroke,
		    fill = layer._fill,
		    options = layer.options,
		    container = layer._container;

		container.stroked = !!options.stroke;
		container.filled = !!options.fill;

		if (options.stroke) {
			if (!stroke) {
				stroke = layer._stroke = vmlCreate('stroke');
			}
			container.appendChild(stroke);
			stroke.weight = options.weight + 'px';
			stroke.color = options.color;
			stroke.opacity = options.opacity;

			if (options.dashArray) {
				stroke.dashStyle = isArray(options.dashArray) ?
				    options.dashArray.join(' ') :
				    options.dashArray.replace(/( *, *)/g, ' ');
			} else {
				stroke.dashStyle = '';
			}
			stroke.endcap = options.lineCap.replace('butt', 'flat');
			stroke.joinstyle = options.lineJoin;

		} else if (stroke) {
			container.removeChild(stroke);
			layer._stroke = null;
		}

		if (options.fill) {
			if (!fill) {
				fill = layer._fill = vmlCreate('fill');
			}
			container.appendChild(fill);
			fill.color = options.fillColor || options.color;
			fill.opacity = options.fillOpacity;

		} else if (fill) {
			container.removeChild(fill);
			layer._fill = null;
		}
	},

	_updateCircle: function (layer) {
		var p = layer._point.round(),
		    r = Math.round(layer._radius),
		    r2 = Math.round(layer._radiusY || r);

		this._setPath(layer, layer._empty() ? 'M0 0' :
			'AL ' + p.x + ',' + p.y + ' ' + r + ',' + r2 + ' 0,' + (65535 * 360));
	},

	_setPath: function (layer, path) {
		layer._path.v = path;
	},

	_bringToFront: function (layer) {
		toFront(layer._container);
	},

	_bringToBack: function (layer) {
		toBack(layer._container);
	}
};

var create$2 = vml ? vmlCreate : svgCreate;

/*
 * @class SVG
 * @inherits Renderer
 * @aka L.SVG
 *
 * Allows vector layers to be displayed with [SVG](https://developer.mozilla.org/docs/Web/SVG).
 * Inherits `Renderer`.
 *
 * Due to [technical limitations](http://caniuse.com/#search=svg), SVG is not
 * available in all web browsers, notably Android 2.x and 3.x.
 *
 * Although SVG is not available on IE7 and IE8, these browsers support
 * [VML](https://en.wikipedia.org/wiki/Vector_Markup_Language)
 * (a now deprecated technology), and the SVG renderer will fall back to VML in
 * this case.
 *
 * @example
 *
 * Use SVG by default for all paths in the map:
 *
 * ```js
 * var map = L.map('map', {
 * 	renderer: L.svg()
 * });
 * ```
 *
 * Use a SVG renderer with extra padding for specific vector geometries:
 *
 * ```js
 * var map = L.map('map');
 * var myRenderer = L.svg({ padding: 0.5 });
 * var line = L.polyline( coordinates, { renderer: myRenderer } );
 * var circle = L.circle( center, { renderer: myRenderer } );
 * ```
 */

var SVG = Renderer.extend({

	getEvents: function () {
		var events = Renderer.prototype.getEvents.call(this);
		events.zoomstart = this._onZoomStart;
		return events;
	},

	_initContainer: function () {
		this._container = create$2('svg');

		// makes it possible to click through svg root; we'll reset it back in individual paths
		this._container.setAttribute('pointer-events', 'none');

		this._rootGroup = create$2('g');
		this._container.appendChild(this._rootGroup);
	},

	_destroyContainer: function () {
		remove(this._container);
		off(this._container);
		delete this._container;
		delete this._rootGroup;
		delete this._svgSize;
	},

	_onZoomStart: function () {
		// Drag-then-pinch interactions might mess up the center and zoom.
		// In this case, the easiest way to prevent this is re-do the renderer
		//   bounds and padding when the zooming starts.
		this._update();
	},

	_update: function () {
		if (this._map._animatingZoom && this._bounds) { return; }

		Renderer.prototype._update.call(this);

		var b = this._bounds,
		    size = b.getSize(),
		    container = this._container;

		// set size of svg-container if changed
		if (!this._svgSize || !this._svgSize.equals(size)) {
			this._svgSize = size;
			container.setAttribute('width', size.x);
			container.setAttribute('height', size.y);
		}

		// movement: update container viewBox so that we don't have to change coordinates of individual layers
		setPosition(container, b.min);
		container.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));

		this.fire('update');
	},

	// methods below are called by vector layers implementations

	_initPath: function (layer) {
		var path = layer._path = create$2('path');

		// @namespace Path
		// @option className: String = null
		// Custom class name set on an element. Only for SVG renderer.
		if (layer.options.className) {
			addClass(path, layer.options.className);
		}

		if (layer.options.interactive) {
			addClass(path, 'leaflet-interactive');
		}

		this._updateStyle(layer);
		this._layers[stamp(layer)] = layer;
	},

	_addPath: function (layer) {
		if (!this._rootGroup) { this._initContainer(); }
		this._rootGroup.appendChild(layer._path);
		layer.addInteractiveTarget(layer._path);
	},

	_removePath: function (layer) {
		remove(layer._path);
		layer.removeInteractiveTarget(layer._path);
		delete this._layers[stamp(layer)];
	},

	_updatePath: function (layer) {
		layer._project();
		layer._update();
	},

	_updateStyle: function (layer) {
		var path = layer._path,
		    options = layer.options;

		if (!path) { return; }

		if (options.stroke) {
			path.setAttribute('stroke', options.color);
			path.setAttribute('stroke-opacity', options.opacity);
			path.setAttribute('stroke-width', options.weight);
			path.setAttribute('stroke-linecap', options.lineCap);
			path.setAttribute('stroke-linejoin', options.lineJoin);

			if (options.dashArray) {
				path.setAttribute('stroke-dasharray', options.dashArray);
			} else {
				path.removeAttribute('stroke-dasharray');
			}

			if (options.dashOffset) {
				path.setAttribute('stroke-dashoffset', options.dashOffset);
			} else {
				path.removeAttribute('stroke-dashoffset');
			}
		} else {
			path.setAttribute('stroke', 'none');
		}

		if (options.fill) {
			path.setAttribute('fill', options.fillColor || options.color);
			path.setAttribute('fill-opacity', options.fillOpacity);
			path.setAttribute('fill-rule', options.fillRule || 'evenodd');
		} else {
			path.setAttribute('fill', 'none');
		}
	},

	_updatePoly: function (layer, closed) {
		this._setPath(layer, pointsToPath(layer._parts, closed));
	},

	_updateCircle: function (layer) {
		var p = layer._point,
		    r = Math.max(Math.round(layer._radius), 1),
		    r2 = Math.max(Math.round(layer._radiusY), 1) || r,
		    arc = 'a' + r + ',' + r2 + ' 0 1,0 ';

		// drawing a circle with two half-arcs
		var d = layer._empty() ? 'M0 0' :
			'M' + (p.x - r) + ',' + p.y +
			arc + (r * 2) + ',0 ' +
			arc + (-r * 2) + ',0 ';

		this._setPath(layer, d);
	},

	_setPath: function (layer, path) {
		layer._path.setAttribute('d', path);
	},

	// SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
	_bringToFront: function (layer) {
		toFront(layer._path);
	},

	_bringToBack: function (layer) {
		toBack(layer._path);
	}
});

if (vml) {
	SVG.include(vmlMixin);
}

// @namespace SVG
// @factory L.svg(options?: Renderer options)
// Creates a SVG renderer with the given options.
function svg$1(options) {
	return svg || vml ? new SVG(options) : null;
}

Map.include({
	// @namespace Map; @method getRenderer(layer: Path): Renderer
	// Returns the instance of `Renderer` that should be used to render the given
	// `Path`. It will ensure that the `renderer` options of the map and paths
	// are respected, and that the renderers do exist on the map.
	getRenderer: function (layer) {
		// @namespace Path; @option renderer: Renderer
		// Use this specific instance of `Renderer` for this path. Takes
		// precedence over the map's [default renderer](#map-renderer).
		var renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;

		if (!renderer) {
			renderer = this._renderer = this._createRenderer();
		}

		if (!this.hasLayer(renderer)) {
			this.addLayer(renderer);
		}
		return renderer;
	},

	_getPaneRenderer: function (name) {
		if (name === 'overlayPane' || name === undefined) {
			return false;
		}

		var renderer = this._paneRenderers[name];
		if (renderer === undefined) {
			renderer = this._createRenderer({pane: name});
			this._paneRenderers[name] = renderer;
		}
		return renderer;
	},

	_createRenderer: function (options) {
		// @namespace Map; @option preferCanvas: Boolean = false
		// Whether `Path`s should be rendered on a `Canvas` renderer.
		// By default, all `Path`s are rendered in a `SVG` renderer.
		return (this.options.preferCanvas && canvas$1(options)) || svg$1(options);
	}
});

/*
 * L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
 */

/*
 * @class Rectangle
 * @aka L.Rectangle
 * @inherits Polygon
 *
 * A class for drawing rectangle overlays on a map. Extends `Polygon`.
 *
 * @example
 *
 * ```js
 * // define rectangle geographical bounds
 * var bounds = [[54.559322, -5.767822], [56.1210604, -3.021240]];
 *
 * // create an orange rectangle
 * L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(map);
 *
 * // zoom the map to the rectangle bounds
 * map.fitBounds(bounds);
 * ```
 *
 */


var Rectangle = Polygon.extend({
	initialize: function (latLngBounds, options) {
		Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
	},

	// @method setBounds(latLngBounds: LatLngBounds): this
	// Redraws the rectangle with the passed bounds.
	setBounds: function (latLngBounds) {
		return this.setLatLngs(this._boundsToLatLngs(latLngBounds));
	},

	_boundsToLatLngs: function (latLngBounds) {
		latLngBounds = toLatLngBounds(latLngBounds);
		return [
			latLngBounds.getSouthWest(),
			latLngBounds.getNorthWest(),
			latLngBounds.getNorthEast(),
			latLngBounds.getSouthEast()
		];
	}
});


// @factory L.rectangle(latLngBounds: LatLngBounds, options?: Polyline options)
function rectangle(latLngBounds, options) {
	return new Rectangle(latLngBounds, options);
}

SVG.create = create$2;
SVG.pointsToPath = pointsToPath;

GeoJSON.geometryToLayer = geometryToLayer;
GeoJSON.coordsToLatLng = coordsToLatLng;
GeoJSON.coordsToLatLngs = coordsToLatLngs;
GeoJSON.latLngToCoords = latLngToCoords;
GeoJSON.latLngsToCoords = latLngsToCoords;
GeoJSON.getFeature = getFeature;
GeoJSON.asFeature = asFeature;

/*
 * L.Handler.BoxZoom is used to add shift-drag zoom interaction to the map
 * (zoom to a selected bounding box), enabled by default.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @option boxZoom: Boolean = true
	// Whether the map can be zoomed to a rectangular area specified by
	// dragging the mouse while pressing the shift key.
	boxZoom: true
});

var BoxZoom = Handler.extend({
	initialize: function (map) {
		this._map = map;
		this._container = map._container;
		this._pane = map._panes.overlayPane;
		this._resetStateTimeout = 0;
		map.on('unload', this._destroy, this);
	},

	addHooks: function () {
		on(this._container, 'mousedown', this._onMouseDown, this);
	},

	removeHooks: function () {
		off(this._container, 'mousedown', this._onMouseDown, this);
	},

	moved: function () {
		return this._moved;
	},

	_destroy: function () {
		remove(this._pane);
		delete this._pane;
	},

	_resetState: function () {
		this._resetStateTimeout = 0;
		this._moved = false;
	},

	_clearDeferredResetState: function () {
		if (this._resetStateTimeout !== 0) {
			clearTimeout(this._resetStateTimeout);
			this._resetStateTimeout = 0;
		}
	},

	_onMouseDown: function (e) {
		if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) { return false; }

		// Clear the deferred resetState if it hasn't executed yet, otherwise it
		// will interrupt the interaction and orphan a box element in the container.
		this._clearDeferredResetState();
		this._resetState();

		disableTextSelection();
		disableImageDrag();

		this._startPoint = this._map.mouseEventToContainerPoint(e);

		on(document, {
			contextmenu: stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	},

	_onMouseMove: function (e) {
		if (!this._moved) {
			this._moved = true;

			this._box = create$1('div', 'leaflet-zoom-box', this._container);
			addClass(this._container, 'leaflet-crosshair');

			this._map.fire('boxzoomstart');
		}

		this._point = this._map.mouseEventToContainerPoint(e);

		var bounds = new Bounds(this._point, this._startPoint),
		    size = bounds.getSize();

		setPosition(this._box, bounds.min);

		this._box.style.width  = size.x + 'px';
		this._box.style.height = size.y + 'px';
	},

	_finish: function () {
		if (this._moved) {
			remove(this._box);
			removeClass(this._container, 'leaflet-crosshair');
		}

		enableTextSelection();
		enableImageDrag();

		off(document, {
			contextmenu: stop,
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp,
			keydown: this._onKeyDown
		}, this);
	},

	_onMouseUp: function (e) {
		if ((e.which !== 1) && (e.button !== 1)) { return; }

		this._finish();

		if (!this._moved) { return; }
		// Postpone to next JS tick so internal click event handling
		// still see it as "moved".
		this._clearDeferredResetState();
		this._resetStateTimeout = setTimeout(bind(this._resetState, this), 0);

		var bounds = new LatLngBounds(
		        this._map.containerPointToLatLng(this._startPoint),
		        this._map.containerPointToLatLng(this._point));

		this._map
			.fitBounds(bounds)
			.fire('boxzoomend', {boxZoomBounds: bounds});
	},

	_onKeyDown: function (e) {
		if (e.keyCode === 27) {
			this._finish();
		}
	}
});

// @section Handlers
// @property boxZoom: Handler
// Box (shift-drag with mouse) zoom handler.
Map.addInitHook('addHandler', 'boxZoom', BoxZoom);

/*
 * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
 */

// @namespace Map
// @section Interaction Options

Map.mergeOptions({
	// @option doubleClickZoom: Boolean|String = true
	// Whether the map can be zoomed in by double clicking on it and
	// zoomed out by double clicking while holding shift. If passed
	// `'center'`, double-click zoom will zoom to the center of the
	//  view regardless of where the mouse was.
	doubleClickZoom: true
});

var DoubleClickZoom = Handler.extend({
	addHooks: function () {
		this._map.on('dblclick', this._onDoubleClick, this);
	},

	removeHooks: function () {
		this._map.off('dblclick', this._onDoubleClick, this);
	},

	_onDoubleClick: function (e) {
		var map = this._map,
		    oldZoom = map.getZoom(),
		    delta = map.options.zoomDelta,
		    zoom = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;

		if (map.options.doubleClickZoom === 'center') {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}
});

// @section Handlers
//
// Map properties include interaction handlers that allow you to control
// interaction behavior in runtime, enabling or disabling certain features such
// as dragging or touch zoom (see `Handler` methods). For example:
//
// ```js
// map.doubleClickZoom.disable();
// ```
//
// @property doubleClickZoom: Handler
// Double click zoom handler.
Map.addInitHook('addHandler', 'doubleClickZoom', DoubleClickZoom);

/*
 * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @option dragging: Boolean = true
	// Whether the map be draggable with mouse/touch or not.
	dragging: true,

	// @section Panning Inertia Options
	// @option inertia: Boolean = *
	// If enabled, panning of the map will have an inertia effect where
	// the map builds momentum while dragging and continues moving in
	// the same direction for some time. Feels especially nice on touch
	// devices. Enabled by default unless running on old Android devices.
	inertia: !android23,

	// @option inertiaDeceleration: Number = 3000
	// The rate with which the inertial movement slows down, in pixels/second².
	inertiaDeceleration: 3400, // px/s^2

	// @option inertiaMaxSpeed: Number = Infinity
	// Max speed of the inertial movement, in pixels/second.
	inertiaMaxSpeed: Infinity, // px/s

	// @option easeLinearity: Number = 0.2
	easeLinearity: 0.2,

	// TODO refactor, move to CRS
	// @option worldCopyJump: Boolean = false
	// With this option enabled, the map tracks when you pan to another "copy"
	// of the world and seamlessly jumps to the original one so that all overlays
	// like markers and vector layers are still visible.
	worldCopyJump: false,

	// @option maxBoundsViscosity: Number = 0.0
	// If `maxBounds` is set, this option will control how solid the bounds
	// are when dragging the map around. The default value of `0.0` allows the
	// user to drag outside the bounds at normal speed, higher values will
	// slow down map dragging outside bounds, and `1.0` makes the bounds fully
	// solid, preventing the user from dragging outside the bounds.
	maxBoundsViscosity: 0.0
});

var Drag = Handler.extend({
	addHooks: function () {
		if (!this._draggable) {
			var map = this._map;

			this._draggable = new Draggable(map._mapPane, map._container);

			this._draggable.on({
				dragstart: this._onDragStart,
				drag: this._onDrag,
				dragend: this._onDragEnd
			}, this);

			this._draggable.on('predrag', this._onPreDragLimit, this);
			if (map.options.worldCopyJump) {
				this._draggable.on('predrag', this._onPreDragWrap, this);
				map.on('zoomend', this._onZoomEnd, this);

				map.whenReady(this._onZoomEnd, this);
			}
		}
		addClass(this._map._container, 'leaflet-grab leaflet-touch-drag');
		this._draggable.enable();
		this._positions = [];
		this._times = [];
	},

	removeHooks: function () {
		removeClass(this._map._container, 'leaflet-grab');
		removeClass(this._map._container, 'leaflet-touch-drag');
		this._draggable.disable();
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	moving: function () {
		return this._draggable && this._draggable._moving;
	},

	_onDragStart: function () {
		var map = this._map;

		map._stop();
		if (this._map.options.maxBounds && this._map.options.maxBoundsViscosity) {
			var bounds = toLatLngBounds(this._map.options.maxBounds);

			this._offsetLimit = toBounds(
				this._map.latLngToContainerPoint(bounds.getNorthWest()).multiplyBy(-1),
				this._map.latLngToContainerPoint(bounds.getSouthEast()).multiplyBy(-1)
					.add(this._map.getSize()));

			this._viscosity = Math.min(1.0, Math.max(0.0, this._map.options.maxBoundsViscosity));
		} else {
			this._offsetLimit = null;
		}

		map
		    .fire('movestart')
		    .fire('dragstart');

		if (map.options.inertia) {
			this._positions = [];
			this._times = [];
		}
	},

	_onDrag: function (e) {
		if (this._map.options.inertia) {
			var time = this._lastTime = +new Date(),
			    pos = this._lastPos = this._draggable._absPos || this._draggable._newPos;

			this._positions.push(pos);
			this._times.push(time);

			this._prunePositions(time);
		}

		this._map
		    .fire('move', e)
		    .fire('drag', e);
	},

	_prunePositions: function (time) {
		while (this._positions.length > 1 && time - this._times[0] > 50) {
			this._positions.shift();
			this._times.shift();
		}
	},

	_onZoomEnd: function () {
		var pxCenter = this._map.getSize().divideBy(2),
		    pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

		this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
		this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
	},

	_viscousLimit: function (value, threshold) {
		return value - (value - threshold) * this._viscosity;
	},

	_onPreDragLimit: function () {
		if (!this._viscosity || !this._offsetLimit) { return; }

		var offset = this._draggable._newPos.subtract(this._draggable._startPos);

		var limit = this._offsetLimit;
		if (offset.x < limit.min.x) { offset.x = this._viscousLimit(offset.x, limit.min.x); }
		if (offset.y < limit.min.y) { offset.y = this._viscousLimit(offset.y, limit.min.y); }
		if (offset.x > limit.max.x) { offset.x = this._viscousLimit(offset.x, limit.max.x); }
		if (offset.y > limit.max.y) { offset.y = this._viscousLimit(offset.y, limit.max.y); }

		this._draggable._newPos = this._draggable._startPos.add(offset);
	},

	_onPreDragWrap: function () {
		// TODO refactor to be able to adjust map pane position after zoom
		var worldWidth = this._worldWidth,
		    halfWidth = Math.round(worldWidth / 2),
		    dx = this._initialWorldOffset,
		    x = this._draggable._newPos.x,
		    newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
		    newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
		    newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

		this._draggable._absPos = this._draggable._newPos.clone();
		this._draggable._newPos.x = newX;
	},

	_onDragEnd: function (e) {
		var map = this._map,
		    options = map.options,

		    noInertia = !options.inertia || this._times.length < 2;

		map.fire('dragend', e);

		if (noInertia) {
			map.fire('moveend');

		} else {
			this._prunePositions(+new Date());

			var direction = this._lastPos.subtract(this._positions[0]),
			    duration = (this._lastTime - this._times[0]) / 1000,
			    ease = options.easeLinearity,

			    speedVector = direction.multiplyBy(ease / duration),
			    speed = speedVector.distanceTo([0, 0]),

			    limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
			    limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

			    decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease),
			    offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

			if (!offset.x && !offset.y) {
				map.fire('moveend');

			} else {
				offset = map._limitOffset(offset, map.options.maxBounds);

				requestAnimFrame(function () {
					map.panBy(offset, {
						duration: decelerationDuration,
						easeLinearity: ease,
						noMoveStart: true,
						animate: true
					});
				});
			}
		}
	}
});

// @section Handlers
// @property dragging: Handler
// Map dragging handler (by both mouse and touch).
Map.addInitHook('addHandler', 'dragging', Drag);

/*
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 */

// @namespace Map
// @section Keyboard Navigation Options
Map.mergeOptions({
	// @option keyboard: Boolean = true
	// Makes the map focusable and allows users to navigate the map with keyboard
	// arrows and `+`/`-` keys.
	keyboard: true,

	// @option keyboardPanDelta: Number = 80
	// Amount of pixels to pan when pressing an arrow key.
	keyboardPanDelta: 80
});

var Keyboard = Handler.extend({

	keyCodes: {
		left:    [37],
		right:   [39],
		down:    [40],
		up:      [38],
		zoomIn:  [187, 107, 61, 171],
		zoomOut: [189, 109, 54, 173]
	},

	initialize: function (map) {
		this._map = map;

		this._setPanDelta(map.options.keyboardPanDelta);
		this._setZoomDelta(map.options.zoomDelta);
	},

	addHooks: function () {
		var container = this._map._container;

		// make the container focusable by tabbing
		if (container.tabIndex <= 0) {
			container.tabIndex = '0';
		}

		on(container, {
			focus: this._onFocus,
			blur: this._onBlur,
			mousedown: this._onMouseDown
		}, this);

		this._map.on({
			focus: this._addHooks,
			blur: this._removeHooks
		}, this);
	},

	removeHooks: function () {
		this._removeHooks();

		off(this._map._container, {
			focus: this._onFocus,
			blur: this._onBlur,
			mousedown: this._onMouseDown
		}, this);

		this._map.off({
			focus: this._addHooks,
			blur: this._removeHooks
		}, this);
	},

	_onMouseDown: function () {
		if (this._focused) { return; }

		var body = document.body,
		    docEl = document.documentElement,
		    top = body.scrollTop || docEl.scrollTop,
		    left = body.scrollLeft || docEl.scrollLeft;

		this._map._container.focus();

		window.scrollTo(left, top);
	},

	_onFocus: function () {
		this._focused = true;
		this._map.fire('focus');
	},

	_onBlur: function () {
		this._focused = false;
		this._map.fire('blur');
	},

	_setPanDelta: function (panDelta) {
		var keys = this._panKeys = {},
		    codes = this.keyCodes,
		    i, len;

		for (i = 0, len = codes.left.length; i < len; i++) {
			keys[codes.left[i]] = [-1 * panDelta, 0];
		}
		for (i = 0, len = codes.right.length; i < len; i++) {
			keys[codes.right[i]] = [panDelta, 0];
		}
		for (i = 0, len = codes.down.length; i < len; i++) {
			keys[codes.down[i]] = [0, panDelta];
		}
		for (i = 0, len = codes.up.length; i < len; i++) {
			keys[codes.up[i]] = [0, -1 * panDelta];
		}
	},

	_setZoomDelta: function (zoomDelta) {
		var keys = this._zoomKeys = {},
		    codes = this.keyCodes,
		    i, len;

		for (i = 0, len = codes.zoomIn.length; i < len; i++) {
			keys[codes.zoomIn[i]] = zoomDelta;
		}
		for (i = 0, len = codes.zoomOut.length; i < len; i++) {
			keys[codes.zoomOut[i]] = -zoomDelta;
		}
	},

	_addHooks: function () {
		on(document, 'keydown', this._onKeyDown, this);
	},

	_removeHooks: function () {
		off(document, 'keydown', this._onKeyDown, this);
	},

	_onKeyDown: function (e) {
		if (e.altKey || e.ctrlKey || e.metaKey) { return; }

		var key = e.keyCode,
		    map = this._map,
		    offset;

		if (key in this._panKeys) {
			if (!map._panAnim || !map._panAnim._inProgress) {
				offset = this._panKeys[key];
				if (e.shiftKey) {
					offset = toPoint(offset).multiplyBy(3);
				}

				map.panBy(offset);

				if (map.options.maxBounds) {
					map.panInsideBounds(map.options.maxBounds);
				}
			}
		} else if (key in this._zoomKeys) {
			map.setZoom(map.getZoom() + (e.shiftKey ? 3 : 1) * this._zoomKeys[key]);

		} else if (key === 27 && map._popup && map._popup.options.closeOnEscapeKey) {
			map.closePopup();

		} else {
			return;
		}

		stop(e);
	}
});

// @section Handlers
// @section Handlers
// @property keyboard: Handler
// Keyboard navigation handler.
Map.addInitHook('addHandler', 'keyboard', Keyboard);

/*
 * L.Handler.ScrollWheelZoom is used by L.Map to enable mouse scroll wheel zoom on the map.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Mousewheel options
	// @option scrollWheelZoom: Boolean|String = true
	// Whether the map can be zoomed by using the mouse wheel. If passed `'center'`,
	// it will zoom to the center of the view regardless of where the mouse was.
	scrollWheelZoom: true,

	// @option wheelDebounceTime: Number = 40
	// Limits the rate at which a wheel can fire (in milliseconds). By default
	// user can't zoom via wheel more often than once per 40 ms.
	wheelDebounceTime: 40,

	// @option wheelPxPerZoomLevel: Number = 60
	// How many scroll pixels (as reported by [L.DomEvent.getWheelDelta](#domevent-getwheeldelta))
	// mean a change of one full zoom level. Smaller values will make wheel-zooming
	// faster (and vice versa).
	wheelPxPerZoomLevel: 60
});

var ScrollWheelZoom = Handler.extend({
	addHooks: function () {
		on(this._map._container, 'mousewheel', this._onWheelScroll, this);

		this._delta = 0;
	},

	removeHooks: function () {
		off(this._map._container, 'mousewheel', this._onWheelScroll, this);
	},

	_onWheelScroll: function (e) {
		var delta = getWheelDelta(e);

		var debounce = this._map.options.wheelDebounceTime;

		this._delta += delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);

		if (!this._startTime) {
			this._startTime = +new Date();
		}

		var left = Math.max(debounce - (+new Date() - this._startTime), 0);

		clearTimeout(this._timer);
		this._timer = setTimeout(bind(this._performZoom, this), left);

		stop(e);
	},

	_performZoom: function () {
		var map = this._map,
		    zoom = map.getZoom(),
		    snap = this._map.options.zoomSnap || 0;

		map._stop(); // stop panning and fly animations if any

		// map the delta with a sigmoid function to -4..4 range leaning on -1..1
		var d2 = this._delta / (this._map.options.wheelPxPerZoomLevel * 4),
		    d3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2)))) / Math.LN2,
		    d4 = snap ? Math.ceil(d3 / snap) * snap : d3,
		    delta = map._limitZoom(zoom + (this._delta > 0 ? d4 : -d4)) - zoom;

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }

		if (map.options.scrollWheelZoom === 'center') {
			map.setZoom(zoom + delta);
		} else {
			map.setZoomAround(this._lastMousePos, zoom + delta);
		}
	}
});

// @section Handlers
// @property scrollWheelZoom: Handler
// Scroll wheel zoom handler.
Map.addInitHook('addHandler', 'scrollWheelZoom', ScrollWheelZoom);

/*
 * L.Map.Tap is used to enable mobile hacks like quick taps and long hold.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Touch interaction options
	// @option tap: Boolean = true
	// Enables mobile hacks for supporting instant taps (fixing 200ms click
	// delay on iOS/Android) and touch holds (fired as `contextmenu` events).
	tap: true,

	// @option tapTolerance: Number = 15
	// The max number of pixels a user can shift his finger during touch
	// for it to be considered a valid tap.
	tapTolerance: 15
});

var Tap = Handler.extend({
	addHooks: function () {
		on(this._map._container, 'touchstart', this._onDown, this);
	},

	removeHooks: function () {
		off(this._map._container, 'touchstart', this._onDown, this);
	},

	_onDown: function (e) {
		if (!e.touches) { return; }

		preventDefault(e);

		this._fireClick = true;

		// don't simulate click or track longpress if more than 1 touch
		if (e.touches.length > 1) {
			this._fireClick = false;
			clearTimeout(this._holdTimeout);
			return;
		}

		var first = e.touches[0],
		    el = first.target;

		this._startPos = this._newPos = new Point(first.clientX, first.clientY);

		// if touching a link, highlight it
		if (el.tagName && el.tagName.toLowerCase() === 'a') {
			addClass(el, 'leaflet-active');
		}

		// simulate long hold but setting a timeout
		this._holdTimeout = setTimeout(bind(function () {
			if (this._isTapValid()) {
				this._fireClick = false;
				this._onUp();
				this._simulateEvent('contextmenu', first);
			}
		}, this), 1000);

		this._simulateEvent('mousedown', first);

		on(document, {
			touchmove: this._onMove,
			touchend: this._onUp
		}, this);
	},

	_onUp: function (e) {
		clearTimeout(this._holdTimeout);

		off(document, {
			touchmove: this._onMove,
			touchend: this._onUp
		}, this);

		if (this._fireClick && e && e.changedTouches) {

			var first = e.changedTouches[0],
			    el = first.target;

			if (el && el.tagName && el.tagName.toLowerCase() === 'a') {
				removeClass(el, 'leaflet-active');
			}

			this._simulateEvent('mouseup', first);

			// simulate click if the touch didn't move too much
			if (this._isTapValid()) {
				this._simulateEvent('click', first);
			}
		}
	},

	_isTapValid: function () {
		return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
	},

	_onMove: function (e) {
		var first = e.touches[0];
		this._newPos = new Point(first.clientX, first.clientY);
		this._simulateEvent('mousemove', first);
	},

	_simulateEvent: function (type, e) {
		var simulatedEvent = document.createEvent('MouseEvents');

		simulatedEvent._simulated = true;
		e.target._simulatedClick = true;

		simulatedEvent.initMouseEvent(
		        type, true, true, window, 1,
		        e.screenX, e.screenY,
		        e.clientX, e.clientY,
		        false, false, false, false, 0, null);

		e.target.dispatchEvent(simulatedEvent);
	}
});

// @section Handlers
// @property tap: Handler
// Mobile touch hacks (quick tap and touch hold) handler.
if (touch && !pointer) {
	Map.addInitHook('addHandler', 'tap', Tap);
}

/*
 * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Touch interaction options
	// @option touchZoom: Boolean|String = *
	// Whether the map can be zoomed by touch-dragging with two fingers. If
	// passed `'center'`, it will zoom to the center of the view regardless of
	// where the touch events (fingers) were. Enabled for touch-capable web
	// browsers except for old Androids.
	touchZoom: touch && !android23,

	// @option bounceAtZoomLimits: Boolean = true
	// Set it to false if you don't want the map to zoom beyond min/max zoom
	// and then bounce back when pinch-zooming.
	bounceAtZoomLimits: true
});

var TouchZoom = Handler.extend({
	addHooks: function () {
		addClass(this._map._container, 'leaflet-touch-zoom');
		on(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	removeHooks: function () {
		removeClass(this._map._container, 'leaflet-touch-zoom');
		off(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	_onTouchStart: function (e) {
		var map = this._map;
		if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

		var p1 = map.mouseEventToContainerPoint(e.touches[0]),
		    p2 = map.mouseEventToContainerPoint(e.touches[1]);

		this._centerPoint = map.getSize()._divideBy(2);
		this._startLatLng = map.containerPointToLatLng(this._centerPoint);
		if (map.options.touchZoom !== 'center') {
			this._pinchStartLatLng = map.containerPointToLatLng(p1.add(p2)._divideBy(2));
		}

		this._startDist = p1.distanceTo(p2);
		this._startZoom = map.getZoom();

		this._moved = false;
		this._zooming = true;

		map._stop();

		on(document, 'touchmove', this._onTouchMove, this);
		on(document, 'touchend', this._onTouchEnd, this);

		preventDefault(e);
	},

	_onTouchMove: function (e) {
		if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

		var map = this._map,
		    p1 = map.mouseEventToContainerPoint(e.touches[0]),
		    p2 = map.mouseEventToContainerPoint(e.touches[1]),
		    scale = p1.distanceTo(p2) / this._startDist;

		this._zoom = map.getScaleZoom(scale, this._startZoom);

		if (!map.options.bounceAtZoomLimits && (
			(this._zoom < map.getMinZoom() && scale < 1) ||
			(this._zoom > map.getMaxZoom() && scale > 1))) {
			this._zoom = map._limitZoom(this._zoom);
		}

		if (map.options.touchZoom === 'center') {
			this._center = this._startLatLng;
			if (scale === 1) { return; }
		} else {
			// Get delta from pinch to center, so centerLatLng is delta applied to initial pinchLatLng
			var delta = p1._add(p2)._divideBy(2)._subtract(this._centerPoint);
			if (scale === 1 && delta.x === 0 && delta.y === 0) { return; }
			this._center = map.unproject(map.project(this._pinchStartLatLng, this._zoom).subtract(delta), this._zoom);
		}

		if (!this._moved) {
			map._moveStart(true, false);
			this._moved = true;
		}

		cancelAnimFrame(this._animRequest);

		var moveFn = bind(map._move, map, this._center, this._zoom, {pinch: true, round: false});
		this._animRequest = requestAnimFrame(moveFn, this, true);

		preventDefault(e);
	},

	_onTouchEnd: function () {
		if (!this._moved || !this._zooming) {
			this._zooming = false;
			return;
		}

		this._zooming = false;
		cancelAnimFrame(this._animRequest);

		off(document, 'touchmove', this._onTouchMove);
		off(document, 'touchend', this._onTouchEnd);

		// Pinch updates GridLayers' levels only when zoomSnap is off, so zoomSnap becomes noUpdate.
		if (this._map.options.zoomAnimation) {
			this._map._animateZoom(this._center, this._map._limitZoom(this._zoom), true, this._map.options.zoomSnap);
		} else {
			this._map._resetView(this._center, this._map._limitZoom(this._zoom));
		}
	}
});

// @section Handlers
// @property touchZoom: Handler
// Touch zoom handler.
Map.addInitHook('addHandler', 'touchZoom', TouchZoom);

Map.BoxZoom = BoxZoom;
Map.DoubleClickZoom = DoubleClickZoom;
Map.Drag = Drag;
Map.Keyboard = Keyboard;
Map.ScrollWheelZoom = ScrollWheelZoom;
Map.Tap = Tap;
Map.TouchZoom = TouchZoom;

Object.freeze = freeze;

exports.version = version;
exports.Control = Control;
exports.control = control;
exports.Browser = Browser;
exports.Evented = Evented;
exports.Mixin = Mixin;
exports.Util = Util;
exports.Class = Class;
exports.Handler = Handler;
exports.extend = extend;
exports.bind = bind;
exports.stamp = stamp;
exports.setOptions = setOptions;
exports.DomEvent = DomEvent;
exports.DomUtil = DomUtil;
exports.PosAnimation = PosAnimation;
exports.Draggable = Draggable;
exports.LineUtil = LineUtil;
exports.PolyUtil = PolyUtil;
exports.Point = Point;
exports.point = toPoint;
exports.Bounds = Bounds;
exports.bounds = toBounds;
exports.Transformation = Transformation;
exports.transformation = toTransformation;
exports.Projection = index;
exports.LatLng = LatLng;
exports.latLng = toLatLng;
exports.LatLngBounds = LatLngBounds;
exports.latLngBounds = toLatLngBounds;
exports.CRS = CRS;
exports.GeoJSON = GeoJSON;
exports.geoJSON = geoJSON;
exports.geoJson = geoJson;
exports.Layer = Layer;
exports.LayerGroup = LayerGroup;
exports.layerGroup = layerGroup;
exports.FeatureGroup = FeatureGroup;
exports.featureGroup = featureGroup;
exports.ImageOverlay = ImageOverlay;
exports.imageOverlay = imageOverlay;
exports.VideoOverlay = VideoOverlay;
exports.videoOverlay = videoOverlay;
exports.SVGOverlay = SVGOverlay;
exports.svgOverlay = svgOverlay;
exports.DivOverlay = DivOverlay;
exports.Popup = Popup;
exports.popup = popup;
exports.Tooltip = Tooltip;
exports.tooltip = tooltip;
exports.Icon = Icon;
exports.icon = icon;
exports.DivIcon = DivIcon;
exports.divIcon = divIcon;
exports.Marker = Marker;
exports.marker = marker;
exports.TileLayer = TileLayer;
exports.tileLayer = tileLayer;
exports.GridLayer = GridLayer;
exports.gridLayer = gridLayer;
exports.SVG = SVG;
exports.svg = svg$1;
exports.Renderer = Renderer;
exports.Canvas = Canvas;
exports.canvas = canvas$1;
exports.Path = Path;
exports.CircleMarker = CircleMarker;
exports.circleMarker = circleMarker;
exports.Circle = Circle;
exports.circle = circle;
exports.Polyline = Polyline;
exports.polyline = polyline;
exports.Polygon = Polygon;
exports.polygon = polygon;
exports.Rectangle = Rectangle;
exports.rectangle = rectangle;
exports.Map = Map;
exports.map = createMap;

var oldL = window.L;
exports.noConflict = function() {
	window.L = oldL;
	return this;
}

// Always export us to window global (see #2364)
window.L = exports;

})));


},{}],33:[function(require,module,exports){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object),
    nativeMax = Math.max;

/** Detect if properties shadowing those on `Object.prototype` are non-enumerable. */
var nonEnumShadows = !propertyIsEnumerable.call({ 'valueOf': 1 }, 'valueOf');

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 */
function baseRest(func, start) {
  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined;

    assignValue(object, key, newValue === undefined ? source[key] : newValue);
  }
  return object;
}

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return baseRest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = (assigner.length > 3 && typeof customizer == 'function')
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Assigns own enumerable string keyed properties of source objects to the
 * destination object. Source objects are applied from left to right.
 * Subsequent sources overwrite property assignments of previous sources.
 *
 * **Note:** This method mutates `object` and is loosely based on
 * [`Object.assign`](https://mdn.io/Object/assign).
 *
 * @static
 * @memberOf _
 * @since 0.10.0
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @see _.assignIn
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * function Bar() {
 *   this.c = 3;
 * }
 *
 * Foo.prototype.b = 2;
 * Bar.prototype.d = 4;
 *
 * _.assign({ 'a': 0 }, new Foo, new Bar);
 * // => { 'a': 1, 'c': 3 }
 */
var assign = createAssigner(function(object, source) {
  if (nonEnumShadows || isPrototype(source) || isArrayLike(source)) {
    copyObject(source, keys(source), object);
    return;
  }
  for (var key in source) {
    if (hasOwnProperty.call(source, key)) {
      assignValue(object, key, source[key]);
    }
  }
});

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

module.exports = assign;

},{}],34:[function(require,module,exports){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Used by `_.defaults` to customize its `_.assignIn` use.
 *
 * @private
 * @param {*} objValue The destination value.
 * @param {*} srcValue The source value.
 * @param {string} key The key of the property to assign.
 * @param {Object} object The parent object of `objValue`.
 * @returns {*} Returns the value to assign.
 */
function assignInDefaults(objValue, srcValue, key, object) {
  if (objValue === undefined ||
      (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) {
    return srcValue;
  }
  return objValue;
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  if (!isObject(object)) {
    return nativeKeysIn(object);
  }
  var isProto = isPrototype(object),
      result = [];

  for (var key in object) {
    if (!(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 */
function baseRest(func, start) {
  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined;

    assignValue(object, key, newValue === undefined ? source[key] : newValue);
  }
  return object;
}

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return baseRest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = (assigner.length > 3 && typeof customizer == 'function')
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * This function is like
 * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * except that it includes inherited enumerable properties.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function nativeKeysIn(object) {
  var result = [];
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * This method is like `_.assignIn` except that it accepts `customizer`
 * which is invoked to produce the assigned values. If `customizer` returns
 * `undefined`, assignment is handled by the method instead. The `customizer`
 * is invoked with five arguments: (objValue, srcValue, key, object, source).
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @alias extendWith
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} sources The source objects.
 * @param {Function} [customizer] The function to customize assigned values.
 * @returns {Object} Returns `object`.
 * @see _.assignWith
 * @example
 *
 * function customizer(objValue, srcValue) {
 *   return _.isUndefined(objValue) ? srcValue : objValue;
 * }
 *
 * var defaults = _.partialRight(_.assignInWith, customizer);
 *
 * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
 * // => { 'a': 1, 'b': 2 }
 */
var assignInWith = createAssigner(function(object, source, srcIndex, customizer) {
  copyObject(source, keysIn(source), object, customizer);
});

/**
 * Assigns own and inherited enumerable string keyed properties of source
 * objects to the destination object for all destination properties that
 * resolve to `undefined`. Source objects are applied from left to right.
 * Once a property is set, additional values of the same property are ignored.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @see _.defaultsDeep
 * @example
 *
 * _.defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
 * // => { 'a': 1, 'b': 2 }
 */
var defaults = baseRest(function(args) {
  args.push(undefined, assignInDefaults);
  return apply(assignInWith, undefined, args);
});

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
}

module.exports = defaults;

},{}],35:[function(require,module,exports){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Iterates over own enumerable string keyed properties of an object and
 * invokes `iteratee` for each property. The iteratee is invoked with three
 * arguments: (value, key, object). Iteratee functions may exit iteration
 * early by explicitly returning `false`.
 *
 * @static
 * @memberOf _
 * @since 0.3.0
 * @category Object
 * @param {Object} object The object to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Object} Returns `object`.
 * @see _.forOwnRight
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.forOwn(new Foo, function(value, key) {
 *   console.log(key);
 * });
 * // => Logs 'a' then 'b' (iteration order is not guaranteed).
 */
function forOwn(object, iteratee) {
  return object && baseForOwn(object, typeof iteratee == 'function' ? iteratee : identity);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = forOwn;

},{}],36:[function(require,module,exports){
"use strict";

var isPrototype = require("../prototype/is");

module.exports = function (value) {
	if (typeof value !== "function") return false;

	if (!hasOwnProperty.call(value, "length")) return false;

	try {
		if (typeof value.length !== "number") return false;
		if (typeof value.call !== "function") return false;
		if (typeof value.apply !== "function") return false;
	} catch (error) {
		return false;
	}

	return !isPrototype(value);
};

},{"../prototype/is":39}],37:[function(require,module,exports){
"use strict";

var isValue = require("../value/is");

// prettier-ignore
var possibleTypes = { "object": true, "function": true, "undefined": true /* document.all */ };

module.exports = function (value) {
	if (!isValue(value)) return false;
	return hasOwnProperty.call(possibleTypes, typeof value);
};

},{"../value/is":40}],38:[function(require,module,exports){
"use strict";

var isFunction = require("../function/is");

var classRe = /^\s*class[\s{/}]/, functionToString = Function.prototype.toString;

module.exports = function (value) {
	if (!isFunction(value)) return false;
	if (classRe.test(functionToString.call(value))) return false;
	return true;
};

},{"../function/is":36}],39:[function(require,module,exports){
"use strict";

var isObject = require("../object/is");

module.exports = function (value) {
	if (!isObject(value)) return false;
	try {
		if (!value.constructor) return false;
		return value.constructor.prototype === value;
	} catch (error) {
		return false;
	}
};

},{"../object/is":37}],40:[function(require,module,exports){
"use strict";

// ES3 safe
var _undefined = void 0;

module.exports = function (value) { return value !== _undefined && value !== null; };

},{}],41:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":46}],42:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":66}],43:[function(require,module,exports){
var h = require("./virtual-hyperscript/index.js")

module.exports = h

},{"./virtual-hyperscript/index.js":53}],44:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":49}],45:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":57,"is-object":30}],46:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":55,"../vnode/is-vnode.js":58,"../vnode/is-vtext.js":59,"../vnode/is-widget.js":60,"./apply-properties":45,"global/document":26}],47:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],48:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":60,"../vnode/vpatch.js":63,"./apply-properties":45,"./update-widget":50}],49:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":46,"./dom-index":47,"./patch-op":48,"global/document":26,"x-is-array":99}],50:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":60}],51:[function(require,module,exports){
'use strict';

var EvStore = require('ev-store');

module.exports = EvHook;

function EvHook(value) {
    if (!(this instanceof EvHook)) {
        return new EvHook(value);
    }

    this.value = value;
}

EvHook.prototype.hook = function (node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = this.value;
};

EvHook.prototype.unhook = function(node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = undefined;
};

},{"ev-store":22}],52:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],53:[function(require,module,exports){
'use strict';

var isArray = require('x-is-array');

var VNode = require('../vnode/vnode.js');
var VText = require('../vnode/vtext.js');
var isVNode = require('../vnode/is-vnode');
var isVText = require('../vnode/is-vtext');
var isWidget = require('../vnode/is-widget');
var isHook = require('../vnode/is-vhook');
var isVThunk = require('../vnode/is-thunk');

var parseTag = require('./parse-tag.js');
var softSetHook = require('./hooks/soft-set-hook.js');
var evHook = require('./hooks/ev-hook.js');

module.exports = h;

function h(tagName, properties, children) {
    var childNodes = [];
    var tag, props, key, namespace;

    if (!children && isChildren(properties)) {
        children = properties;
        props = {};
    }

    props = props || properties || {};
    tag = parseTag(tagName, props);

    // support keys
    if (props.hasOwnProperty('key')) {
        key = props.key;
        props.key = undefined;
    }

    // support namespace
    if (props.hasOwnProperty('namespace')) {
        namespace = props.namespace;
        props.namespace = undefined;
    }

    // fix cursor bug
    if (tag === 'INPUT' &&
        !namespace &&
        props.hasOwnProperty('value') &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        props.value = softSetHook(props.value);
    }

    transformProperties(props);

    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props);
    }


    return new VNode(tag, props, childNodes, key, namespace);
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === 'string') {
        childNodes.push(new VText(c));
    } else if (typeof c === 'number') {
        childNodes.push(new VText(String(c)));
    } else if (isChild(c)) {
        childNodes.push(c);
    } else if (isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props);
        }
    } else if (c === null || c === undefined) {
        return;
    } else {
        throw UnexpectedVirtualElement({
            foreignObject: c,
            parentVnode: {
                tagName: tag,
                properties: props
            }
        });
    }
}

function transformProperties(props) {
    for (var propName in props) {
        if (props.hasOwnProperty(propName)) {
            var value = props[propName];

            if (isHook(value)) {
                continue;
            }

            if (propName.substr(0, 3) === 'ev-') {
                // add ev-foo support
                props[propName] = evHook(value);
            }
        }
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
}

function isChildren(x) {
    return typeof x === 'string' || isArray(x) || isChild(x);
}

function UnexpectedVirtualElement(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unexpected.virtual-element';
    err.message = 'Unexpected virtual child passed to h().\n' +
        'Expected a VNode / Vthunk / VWidget / string but:\n' +
        'got:\n' +
        errorString(data.foreignObject) +
        '.\n' +
        'The parent vnode is:\n' +
        errorString(data.parentVnode)
        '\n' +
        'Suggested fix: change your `h(..., [ ... ])` callsite.';
    err.foreignObject = data.foreignObject;
    err.parentVnode = data.parentVnode;

    return err;
}

function errorString(obj) {
    try {
        return JSON.stringify(obj, null, '    ');
    } catch (e) {
        return String(obj);
    }
}

},{"../vnode/is-thunk":56,"../vnode/is-vhook":57,"../vnode/is-vnode":58,"../vnode/is-vtext":59,"../vnode/is-widget":60,"../vnode/vnode.js":62,"../vnode/vtext.js":64,"./hooks/ev-hook.js":51,"./hooks/soft-set-hook.js":52,"./parse-tag.js":54,"x-is-array":99}],54:[function(require,module,exports){
'use strict';

var split = require('browser-split');

var classIdSplit = /([\.#]?[a-zA-Z0-9\u007F-\uFFFF_:-]+)/;
var notClassId = /^\.|#/;

module.exports = parseTag;

function parseTag(tag, props) {
    if (!tag) {
        return 'DIV';
    }

    var noId = !(props.hasOwnProperty('id'));

    var tagParts = split(tag, classIdSplit);
    var tagName = null;

    if (notClassId.test(tagParts[1])) {
        tagName = 'DIV';
    }

    var classes, part, type, i;

    for (i = 0; i < tagParts.length; i++) {
        part = tagParts[i];

        if (!part) {
            continue;
        }

        type = part.charAt(0);

        if (!tagName) {
            tagName = part;
        } else if (type === '.') {
            classes = classes || [];
            classes.push(part.substring(1, part.length));
        } else if (type === '#' && noId) {
            props.id = part.substring(1, part.length);
        }
    }

    if (classes) {
        if (props.className) {
            classes.push(props.className);
        }

        props.className = classes.join(' ');
    }

    return props.namespace ? tagName : tagName.toUpperCase();
}

},{"browser-split":6}],55:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":56,"./is-vnode":58,"./is-vtext":59,"./is-widget":60}],56:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],57:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],58:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":61}],59:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":61}],60:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],61:[function(require,module,exports){
module.exports = "2"

},{}],62:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":56,"./is-vhook":57,"./is-vnode":58,"./is-widget":60,"./version":61}],63:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":61}],64:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":61}],65:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":57,"is-object":30}],66:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":55,"../vnode/is-thunk":56,"../vnode/is-vnode":58,"../vnode/is-vtext":59,"../vnode/is-widget":60,"../vnode/vpatch":63,"./diff-props":65,"x-is-array":99}],67:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash.defaults');

var _lodash2 = _interopRequireDefault(_lodash);

var _h = require('virtual-dom/h');

var _h2 = _interopRequireDefault(_h);

var _diff = require('virtual-dom/diff');

var _diff2 = _interopRequireDefault(_diff);

var _patch = require('virtual-dom/patch');

var _patch2 = _interopRequireDefault(_patch);

var _inlineWorker = require('inline-worker');

var _inlineWorker2 = _interopRequireDefault(_inlineWorker);

var _conversions = require('./utils/conversions');

var _LoaderFactory = require('./track/loader/LoaderFactory');

var _LoaderFactory2 = _interopRequireDefault(_LoaderFactory);

var _ScrollHook = require('./render/ScrollHook');

var _ScrollHook2 = _interopRequireDefault(_ScrollHook);

var _TimeScale = require('./TimeScale');

var _TimeScale2 = _interopRequireDefault(_TimeScale);

var _Track = require('./Track');

var _Track2 = _interopRequireDefault(_Track);

var _Playout = require('./Playout');

var _Playout2 = _interopRequireDefault(_Playout);

var _AnnotationList = require('./annotation/AnnotationList');

var _AnnotationList2 = _interopRequireDefault(_AnnotationList);

var _recorderWorker = require('./utils/recorderWorker');

var _recorderWorker2 = _interopRequireDefault(_recorderWorker);

var _exportWavWorker = require('./utils/exportWavWorker');

var _exportWavWorker2 = _interopRequireDefault(_exportWavWorker);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.tracks = [];
    this.soloedTracks = [];
    this.mutedTracks = [];
    this.playoutPromises = [];

    this.cursor = 0;
    this.playbackSeconds = 0;
    this.duration = 0;
    this.scrollLeft = 0;
    this.scrollTimer = undefined;
    this.showTimescale = false;
    // whether a user is scrolling the waveform
    this.isScrolling = false;

    this.fadeType = 'logarithmic';
    this.masterGain = 1;
    this.annotations = [];
    this.durationFormat = 'hh:mm:ss.uuu';
    this.isAutomaticScroll = false;
    this.resetDrawTimer = undefined;
  }

  // TODO extract into a plugin


  _createClass(_class, [{
    key: 'initExporter',
    value: function initExporter() {
      this.exportWorker = new _inlineWorker2.default(_exportWavWorker2.default);
    }

    // TODO extract into a plugin

  }, {
    key: 'initRecorder',
    value: function initRecorder(stream) {
      var _this = this;

      this.mediaRecorder = new window.MediaRecorder(stream);

      this.mediaRecorder.onstart = function () {
        var track = new _Track2.default();
        track.setName('Recording');
        track.setEnabledStates();
        track.setEventEmitter(_this.ee);

        _this.recordingTrack = track;
        _this.tracks.push(track);

        _this.chunks = [];
        _this.working = false;
      };

      this.mediaRecorder.ondataavailable = function (e) {
        _this.chunks.push(e.data);

        // throttle peaks calculation
        if (!_this.working) {
          var recording = new Blob(_this.chunks, { type: 'audio/ogg; codecs=opus' });
          var loader = _LoaderFactory2.default.createLoader(recording, _this.ac);
          loader.load().then(function (audioBuffer) {
            // ask web worker for peaks.
            _this.recorderWorker.postMessage({
              samples: audioBuffer.getChannelData(0),
              samplesPerPixel: _this.samplesPerPixel
            });
            _this.recordingTrack.setCues(0, audioBuffer.duration);
            _this.recordingTrack.setBuffer(audioBuffer);
            _this.recordingTrack.setPlayout(new _Playout2.default(_this.ac, audioBuffer));
            _this.adjustDuration();
          });
          _this.working = true;
        }
      };

      this.mediaRecorder.onstop = function () {
        _this.chunks = [];
        _this.working = false;
      };

      this.recorderWorker = new _inlineWorker2.default(_recorderWorker2.default);
      // use a worker for calculating recording peaks.
      this.recorderWorker.onmessage = function (e) {
        _this.recordingTrack.setPeaks(e.data);
        _this.working = false;
        _this.drawRequest();
      };
    }
  }, {
    key: 'setShowTimeScale',
    value: function setShowTimeScale(show) {
      this.showTimescale = show;
    }
  }, {
    key: 'setMono',
    value: function setMono(mono) {
      this.mono = mono;
    }
  }, {
    key: 'setExclSolo',
    value: function setExclSolo(exclSolo) {
      this.exclSolo = exclSolo;
    }
  }, {
    key: 'setSeekStyle',
    value: function setSeekStyle(style) {
      this.seekStyle = style;
    }
  }, {
    key: 'getSeekStyle',
    value: function getSeekStyle() {
      return this.seekStyle;
    }
  }, {
    key: 'setSampleRate',
    value: function setSampleRate(sampleRate) {
      this.sampleRate = sampleRate;
    }
  }, {
    key: 'setSamplesPerPixel',
    value: function setSamplesPerPixel(samplesPerPixel) {
      this.samplesPerPixel = samplesPerPixel;
    }
  }, {
    key: 'setAudioContext',
    value: function setAudioContext(ac) {
      this.ac = ac;
    }
  }, {
    key: 'setControlOptions',
    value: function setControlOptions(controlOptions) {
      this.controls = controlOptions;
    }
  }, {
    key: 'setWaveHeight',
    value: function setWaveHeight(height) {
      this.waveHeight = height;
    }
  }, {
    key: 'setColors',
    value: function setColors(colors) {
      this.colors = colors;
    }
  }, {
    key: 'setAnnotations',
    value: function setAnnotations(config) {
      this.annotationList = new _AnnotationList2.default(this, config.annotations, config.controls, config.editable, config.linkEndpoints, config.isContinuousPlay);
    }
  }, {
    key: 'setEventEmitter',
    value: function setEventEmitter(ee) {
      this.ee = ee;
    }
  }, {
    key: 'getEventEmitter',
    value: function getEventEmitter() {
      return this.ee;
    }
  }, {
    key: 'setUpEventEmitter',
    value: function setUpEventEmitter() {
      var _this2 = this;

      var ee = this.ee;

      ee.on('automaticscroll', function (val) {
        _this2.isAutomaticScroll = val;
      });

      ee.on('durationformat', function (format) {
        _this2.durationFormat = format;
        _this2.drawRequest();
      });

      ee.on('select', function (start, end, track) {
        if (_this2.isPlaying()) {
          _this2.lastSeeked = start;
          _this2.pausedAt = undefined;
          _this2.restartPlayFrom(start);
        } else {
          // reset if it was paused.
          _this2.seek(start, end, track);
          _this2.ee.emit('timeupdate', start);
          _this2.drawRequest();
        }
      });

      ee.on('startaudiorendering', function (type) {
        _this2.startOfflineRender(type);
      });

      ee.on('statechange', function (state) {
        _this2.setState(state);
        _this2.drawRequest();
      });

      ee.on('shift', function (deltaTime, track) {
        track.setStartTime(track.getStartTime() + deltaTime);
        _this2.adjustDuration();
        _this2.drawRequest();
      });

      ee.on('record', function () {
        _this2.record();
      });

      ee.on('play', function (start, end) {
        _this2.play(start, end);
      });

      ee.on('pause', function () {
        _this2.pause();
      });

      ee.on('stop', function () {
        _this2.stop();
      });

      ee.on('rewind', function () {
        _this2.rewind();
      });

      ee.on('fastforward', function () {
        _this2.fastForward();
      });

      ee.on('clear', function () {
        _this2.clear().then(function () {
          _this2.drawRequest();
        });
      });

      ee.on('solo', function (track) {
        _this2.soloTrack(track);
        _this2.adjustTrackPlayout();
        _this2.drawRequest();
      });

      ee.on('mute', function (track) {
        _this2.muteTrack(track);
        _this2.adjustTrackPlayout();
        _this2.drawRequest();
      });

      ee.on('volumechange', function (volume, track) {
        track.setGainLevel(volume / 100);
      });

      ee.on('mastervolumechange', function (volume) {
        _this2.masterGain = volume / 100;
        _this2.tracks.forEach(function (track) {
          track.setMasterGainLevel(_this2.masterGain);
        });
      });

      ee.on('fadein', function (duration, track) {
        track.setFadeIn(duration, _this2.fadeType);
        _this2.drawRequest();
      });

      ee.on('fadeout', function (duration, track) {
        track.setFadeOut(duration, _this2.fadeType);
        _this2.drawRequest();
      });

      ee.on('fadetype', function (type) {
        _this2.fadeType = type;
      });

      ee.on('newtrack', function (file) {
        _this2.load([{
          src: file,
          name: file.name
        }]);
      });

      ee.on('trim', function () {
        var track = _this2.getActiveTrack();
        var timeSelection = _this2.getTimeSelection();

        track.trim(timeSelection.start, timeSelection.end);
        track.calculatePeaks(_this2.samplesPerPixel, _this2.sampleRate);

        _this2.setTimeSelection(0, 0);
        _this2.drawRequest();
      });

      ee.on('zoomin', function () {
        var zoomIndex = Math.max(0, _this2.zoomIndex - 1);
        var zoom = _this2.zoomLevels[zoomIndex];

        if (zoom !== _this2.samplesPerPixel) {
          _this2.setZoom(zoom);
          _this2.drawRequest();
        }
      });

      ee.on('zoomout', function () {
        var zoomIndex = Math.min(_this2.zoomLevels.length - 1, _this2.zoomIndex + 1);
        var zoom = _this2.zoomLevels[zoomIndex];

        if (zoom !== _this2.samplesPerPixel) {
          _this2.setZoom(zoom);
          _this2.drawRequest();
        }
      });

      ee.on('scroll', function () {
        _this2.isScrolling = true;
        _this2.drawRequest();
        clearTimeout(_this2.scrollTimer);
        _this2.scrollTimer = setTimeout(function () {
          _this2.isScrolling = false;
        }, 200);
      });
    }
  }, {
    key: 'load',
    value: function load(trackList) {
      var _this3 = this;

      var loadPromises = trackList.map(function (trackInfo) {
        var loader = _LoaderFactory2.default.createLoader(trackInfo.src, _this3.ac, _this3.ee);
        return loader.load();
      });

      return Promise.all(loadPromises).then(function (audioBuffers) {
        _this3.ee.emit('audiosourcesloaded');

        var tracks = audioBuffers.map(function (audioBuffer, index) {
          var info = trackList[index];
          var name = info.name || 'Untitled';
          var start = info.start || 0;
          var states = info.states || {};
          var fadeIn = info.fadeIn;
          var fadeOut = info.fadeOut;
          var cueIn = info.cuein || 0;
          var cueOut = info.cueout || audioBuffer.duration;
          var gain = info.gain || 1;
          var muted = info.muted || false;
          var soloed = info.soloed || false;
          var selection = info.selected;
          var peaks = info.peaks || { type: 'WebAudio', mono: _this3.mono };
          var customClass = info.customClass || undefined;
          var waveOutlineColor = info.waveOutlineColor || undefined;

          // webaudio specific playout for now.
          var playout = new _Playout2.default(_this3.ac, audioBuffer);

          var track = new _Track2.default();
          track.src = info.src;
          track.setBuffer(audioBuffer);
          track.setName(name);
          track.setEventEmitter(_this3.ee);
          track.setEnabledStates(states);
          track.setCues(cueIn, cueOut);
          track.setCustomClass(customClass);
          track.setWaveOutlineColor(waveOutlineColor);

          if (fadeIn !== undefined) {
            track.setFadeIn(fadeIn.duration, fadeIn.shape);
          }

          if (fadeOut !== undefined) {
            track.setFadeOut(fadeOut.duration, fadeOut.shape);
          }

          if (selection !== undefined) {
            _this3.setActiveTrack(track);
            _this3.setTimeSelection(selection.start, selection.end);
          }

          if (peaks !== undefined) {
            track.setPeakData(peaks);
          }

          track.setState(_this3.getState());
          track.setStartTime(start);
          track.setPlayout(playout);

          track.setGainLevel(gain);

          if (muted) {
            _this3.muteTrack(track);
          }

          if (soloed) {
            _this3.soloTrack(track);
          }

          // extract peaks with AudioContext for now.
          track.calculatePeaks(_this3.samplesPerPixel, _this3.sampleRate);

          return track;
        });

        _this3.tracks = _this3.tracks.concat(tracks);
        _this3.adjustDuration();
        _this3.draw(_this3.render());

        _this3.ee.emit('audiosourcesrendered');
      });
    }

    /*
      track instance of Track.
    */

  }, {
    key: 'setActiveTrack',
    value: function setActiveTrack(track) {
      this.activeTrack = track;
    }
  }, {
    key: 'getActiveTrack',
    value: function getActiveTrack() {
      return this.activeTrack;
    }
  }, {
    key: 'isSegmentSelection',
    value: function isSegmentSelection() {
      return this.timeSelection.start !== this.timeSelection.end;
    }

    /*
      start, end in seconds.
    */

  }, {
    key: 'setTimeSelection',
    value: function setTimeSelection() {
      var start = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
      var end = arguments[1];

      this.timeSelection = {
        start: start,
        end: end === undefined ? start : end
      };

      this.cursor = start;
    }
  }, {
    key: 'startOfflineRender',
    value: function startOfflineRender(type) {
      var _this4 = this;

      if (this.isRendering) {
        return;
      }

      this.isRendering = true;
      this.offlineAudioContext = new OfflineAudioContext(2, 44100 * this.duration, 44100);

      var currentTime = this.offlineAudioContext.currentTime;

      this.tracks.forEach(function (track) {
        track.setOfflinePlayout(new _Playout2.default(_this4.offlineAudioContext, track.buffer));
        track.schedulePlay(currentTime, 0, 0, {
          shouldPlay: _this4.shouldTrackPlay(track),
          masterGain: 1,
          isOffline: true
        });
      });

      /*
        TODO cleanup of different audio playouts handling.
      */
      this.offlineAudioContext.startRendering().then(function (audioBuffer) {
        if (type === 'buffer') {
          _this4.ee.emit('audiorenderingfinished', type, audioBuffer);
          _this4.isRendering = false;
          return;
        }

        if (type === 'wav') {
          _this4.exportWorker.postMessage({
            command: 'init',
            config: {
              sampleRate: 44100
            }
          });

          // callback for `exportWAV`
          _this4.exportWorker.onmessage = function (e) {
            _this4.ee.emit('audiorenderingfinished', type, e.data);
            _this4.isRendering = false;

            // clear out the buffer for next renderings.
            _this4.exportWorker.postMessage({
              command: 'clear'
            });
          };

          // send the channel data from our buffer to the worker
          _this4.exportWorker.postMessage({
            command: 'record',
            buffer: [audioBuffer.getChannelData(0), audioBuffer.getChannelData(1)]
          });

          // ask the worker for a WAV
          _this4.exportWorker.postMessage({
            command: 'exportWAV',
            type: 'audio/wav'
          });
        }
      }).catch(function (e) {
        throw e;
      });
    }
  }, {
    key: 'getTimeSelection',
    value: function getTimeSelection() {
      return this.timeSelection;
    }
  }, {
    key: 'setState',
    value: function setState(state) {
      this.state = state;

      this.tracks.forEach(function (track) {
        track.setState(state);
      });
    }
  }, {
    key: 'getState',
    value: function getState() {
      return this.state;
    }
  }, {
    key: 'setZoomIndex',
    value: function setZoomIndex(index) {
      this.zoomIndex = index;
    }
  }, {
    key: 'setZoomLevels',
    value: function setZoomLevels(levels) {
      this.zoomLevels = levels;
    }
  }, {
    key: 'setZoom',
    value: function setZoom(zoom) {
      var _this5 = this;

      this.samplesPerPixel = zoom;
      this.zoomIndex = this.zoomLevels.indexOf(zoom);
      this.tracks.forEach(function (track) {
        track.calculatePeaks(zoom, _this5.sampleRate);
      });
    }
  }, {
    key: 'muteTrack',
    value: function muteTrack(track) {
      var index = this.mutedTracks.indexOf(track);

      if (index > -1) {
        this.mutedTracks.splice(index, 1);
      } else {
        this.mutedTracks.push(track);
      }
    }
  }, {
    key: 'soloTrack',
    value: function soloTrack(track) {
      var index = this.soloedTracks.indexOf(track);

      if (index > -1) {
        this.soloedTracks.splice(index, 1);
      } else if (this.exclSolo) {
        this.soloedTracks = [track];
      } else {
        this.soloedTracks.push(track);
      }
    }
  }, {
    key: 'adjustTrackPlayout',
    value: function adjustTrackPlayout() {
      var _this6 = this;

      this.tracks.forEach(function (track) {
        track.setShouldPlay(_this6.shouldTrackPlay(track));
      });
    }
  }, {
    key: 'adjustDuration',
    value: function adjustDuration() {
      this.duration = this.tracks.reduce(function (duration, track) {
        return Math.max(duration, track.getEndTime());
      }, 0);
    }
  }, {
    key: 'shouldTrackPlay',
    value: function shouldTrackPlay(track) {
      var shouldPlay = void 0;
      // if there are solo tracks, only they should play.
      if (this.soloedTracks.length > 0) {
        shouldPlay = false;
        if (this.soloedTracks.indexOf(track) > -1) {
          shouldPlay = true;
        }
      } else {
        // play all tracks except any muted tracks.
        shouldPlay = true;
        if (this.mutedTracks.indexOf(track) > -1) {
          shouldPlay = false;
        }
      }

      return shouldPlay;
    }
  }, {
    key: 'isPlaying',
    value: function isPlaying() {
      return this.tracks.reduce(function (isPlaying, track) {
        return isPlaying || track.isPlaying();
      }, false);
    }

    /*
    *   returns the current point of time in the playlist in seconds.
    */

  }, {
    key: 'getCurrentTime',
    value: function getCurrentTime() {
      var cursorPos = this.lastSeeked || this.pausedAt || this.cursor;

      return cursorPos + this.getElapsedTime();
    }
  }, {
    key: 'getElapsedTime',
    value: function getElapsedTime() {
      return this.ac.currentTime - this.lastPlay;
    }
  }, {
    key: 'setMasterGain',
    value: function setMasterGain(gain) {
      this.ee.emit('mastervolumechange', gain);
    }
  }, {
    key: 'restartPlayFrom',
    value: function restartPlayFrom(start, end) {
      this.stopAnimation();

      this.tracks.forEach(function (editor) {
        editor.scheduleStop();
      });

      return Promise.all(this.playoutPromises).then(this.play.bind(this, start, end));
    }
  }, {
    key: 'play',
    value: function play(startTime, endTime) {
      var _this7 = this;

      clearTimeout(this.resetDrawTimer);

      var currentTime = this.ac.currentTime;
      var selected = this.getTimeSelection();
      var playoutPromises = [];

      var start = startTime || this.pausedAt || this.cursor;
      var end = endTime;

      if (!end && selected.end !== selected.start && selected.end > start) {
        end = selected.end;
      }

      if (this.isPlaying()) {
        return this.restartPlayFrom(start, end);
      }

      this.tracks.forEach(function (track) {
        track.setState('cursor');
        playoutPromises.push(track.schedulePlay(currentTime, start, end, {
          shouldPlay: _this7.shouldTrackPlay(track),
          masterGain: _this7.masterGain
        }));
      });

      this.lastPlay = currentTime;
      // use these to track when the playlist has fully stopped.
      this.playoutPromises = playoutPromises;
      this.startAnimation(start);

      return Promise.all(this.playoutPromises);
    }
  }, {
    key: 'pause',
    value: function pause() {
      if (!this.isPlaying()) {
        return Promise.all(this.playoutPromises);
      }

      this.pausedAt = this.getCurrentTime();
      return this.playbackReset();
    }
  }, {
    key: 'stop',
    value: function stop() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      this.pausedAt = undefined;
      this.playbackSeconds = 0;
      return this.playbackReset();
    }
  }, {
    key: 'playbackReset',
    value: function playbackReset() {
      var _this8 = this;

      this.lastSeeked = undefined;
      this.stopAnimation();

      this.tracks.forEach(function (track) {
        track.scheduleStop();
        track.setState(_this8.getState());
      });

      this.drawRequest();
      return Promise.all(this.playoutPromises);
    }
  }, {
    key: 'rewind',
    value: function rewind() {
      var _this9 = this;

      return this.stop().then(function () {
        _this9.scrollLeft = 0;
        _this9.ee.emit('select', 0, 0);
      });
    }
  }, {
    key: 'fastForward',
    value: function fastForward() {
      var _this10 = this;

      return this.stop().then(function () {
        if (_this10.viewDuration < _this10.duration) {
          _this10.scrollLeft = _this10.duration - _this10.viewDuration;
        } else {
          _this10.scrollLeft = 0;
        }

        _this10.ee.emit('select', _this10.duration, _this10.duration);
      });
    }
  }, {
    key: 'clear',
    value: function clear() {
      var _this11 = this;

      return this.stop().then(function () {
        _this11.tracks = [];
        _this11.soloedTracks = [];
        _this11.mutedTracks = [];
        _this11.playoutPromises = [];

        _this11.cursor = 0;
        _this11.playbackSeconds = 0;
        _this11.duration = 0;
        _this11.scrollLeft = 0;

        _this11.seek(0, 0, undefined);
      });
    }
  }, {
    key: 'record',
    value: function record() {
      var _this12 = this;

      var playoutPromises = [];
      this.mediaRecorder.start(300);

      this.tracks.forEach(function (track) {
        track.setState('none');
        playoutPromises.push(track.schedulePlay(_this12.ac.currentTime, 0, undefined, {
          shouldPlay: _this12.shouldTrackPlay(track)
        }));
      });

      this.playoutPromises = playoutPromises;
    }
  }, {
    key: 'startAnimation',
    value: function startAnimation(startTime) {
      var _this13 = this;

      this.lastDraw = this.ac.currentTime;
      this.animationRequest = window.requestAnimationFrame(function () {
        _this13.updateEditor(startTime);
      });
    }
  }, {
    key: 'stopAnimation',
    value: function stopAnimation() {
      window.cancelAnimationFrame(this.animationRequest);
      this.lastDraw = undefined;
    }
  }, {
    key: 'seek',
    value: function seek(start, end, track) {
      if (this.isPlaying()) {
        this.lastSeeked = start;
        this.pausedAt = undefined;
        this.restartPlayFrom(start);
      } else {
        // reset if it was paused.
        this.setActiveTrack(track || this.tracks[0]);
        this.pausedAt = start;
        this.setTimeSelection(start, end);
        if (this.getSeekStyle() === 'fill') {
          this.playbackSeconds = start;
        }
      }
    }

    /*
    * Animation function for the playlist.
    * Keep under 16.7 milliseconds based on a typical screen refresh rate of 60fps.
    */

  }, {
    key: 'updateEditor',
    value: function updateEditor(cursor) {
      var _this14 = this;

      var currentTime = this.ac.currentTime;
      var selection = this.getTimeSelection();
      var cursorPos = cursor || this.cursor;
      var elapsed = currentTime - this.lastDraw;

      if (this.isPlaying()) {
        var playbackSeconds = cursorPos + elapsed;
        this.ee.emit('timeupdate', playbackSeconds);
        this.animationRequest = window.requestAnimationFrame(function () {
          _this14.updateEditor(playbackSeconds);
        });

        this.playbackSeconds = playbackSeconds;
        this.draw(this.render());
        this.lastDraw = currentTime;
      } else {
        if (cursorPos + elapsed >= (this.isSegmentSelection() ? selection.end : this.duration)) {
          this.ee.emit('finished');
        }

        this.stopAnimation();

        this.resetDrawTimer = setTimeout(function () {
          _this14.pausedAt = undefined;
          _this14.lastSeeked = undefined;
          _this14.setState(_this14.getState());

          _this14.playbackSeconds = 0;
          _this14.draw(_this14.render());
        }, 0);
      }
    }
  }, {
    key: 'drawRequest',
    value: function drawRequest() {
      var _this15 = this;

      window.requestAnimationFrame(function () {
        _this15.draw(_this15.render());
      });
    }
  }, {
    key: 'draw',
    value: function draw(newTree) {
      var patches = (0, _diff2.default)(this.tree, newTree);
      this.rootNode = (0, _patch2.default)(this.rootNode, patches);
      this.tree = newTree;

      // use for fast forwarding.
      this.viewDuration = (0, _conversions.pixelsToSeconds)(this.rootNode.clientWidth - this.controls.width, this.samplesPerPixel, this.sampleRate);
    }
  }, {
    key: 'getTrackRenderData',
    value: function getTrackRenderData() {
      var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var defaults = {
        height: this.waveHeight,
        resolution: this.samplesPerPixel,
        sampleRate: this.sampleRate,
        controls: this.controls,
        isActive: false,
        timeSelection: this.getTimeSelection(),
        playlistLength: this.duration,
        playbackSeconds: this.playbackSeconds,
        colors: this.colors
      };

      return (0, _lodash2.default)(data, defaults);
    }
  }, {
    key: 'isActiveTrack',
    value: function isActiveTrack(track) {
      var activeTrack = this.getActiveTrack();

      if (this.isSegmentSelection()) {
        return activeTrack === track;
      }

      return true;
    }
  }, {
    key: 'renderAnnotations',
    value: function renderAnnotations() {
      return this.annotationList.render();
    }
  }, {
    key: 'renderTimeScale',
    value: function renderTimeScale() {
      var controlWidth = this.controls.show ? this.controls.width : 0;
      var timeScale = new _TimeScale2.default(this.duration, this.scrollLeft, this.samplesPerPixel, this.sampleRate, controlWidth);

      return timeScale.render();
    }
  }, {
    key: 'renderTrackSection',
    value: function renderTrackSection() {
      var _this16 = this;

      var trackElements = this.tracks.map(function (track) {
        return track.render(_this16.getTrackRenderData({
          isActive: _this16.isActiveTrack(track),
          shouldPlay: _this16.shouldTrackPlay(track),
          soloed: _this16.soloedTracks.indexOf(track) > -1,
          muted: _this16.mutedTracks.indexOf(track) > -1
        }));
      });

      return (0, _h2.default)('div.playlist-tracks', {
        attributes: {
          style: 'overflow: auto;'
        },
        onscroll: function onscroll(e) {
          _this16.scrollLeft = (0, _conversions.pixelsToSeconds)(e.target.scrollLeft, _this16.samplesPerPixel, _this16.sampleRate);

          _this16.ee.emit('scroll', _this16.scrollLeft);
        },
        hook: new _ScrollHook2.default(this)
      }, trackElements);
    }
  }, {
    key: 'render',
    value: function render() {
      var containerChildren = [];

      if (this.showTimescale) {
        containerChildren.push(this.renderTimeScale());
      }

      containerChildren.push(this.renderTrackSection());

      if (this.annotationList.length) {
        containerChildren.push(this.renderAnnotations());
      }

      return (0, _h2.default)('div.playlist', {
        attributes: {
          style: 'overflow: hidden; position: relative;'
        }
      }, containerChildren);
    }
  }, {
    key: 'getInfo',
    value: function getInfo() {
      var info = [];

      this.tracks.forEach(function (track) {
        info.push(track.getTrackDetails());
      });

      return info;
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"./Playout":68,"./TimeScale":69,"./Track":70,"./annotation/AnnotationList":71,"./render/ScrollHook":79,"./track/loader/LoaderFactory":84,"./utils/conversions":92,"./utils/exportWavWorker":93,"./utils/recorderWorker":94,"inline-worker":29,"lodash.defaults":34,"virtual-dom/diff":42,"virtual-dom/h":43,"virtual-dom/patch":44}],68:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fadeMaker = require('fade-maker');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class(ac, buffer) {
    _classCallCheck(this, _class);

    this.ac = ac;
    this.gain = 1;
    this.buffer = buffer;
    this.destination = this.ac.destination;
  }

  _createClass(_class, [{
    key: 'applyFade',
    value: function applyFade(type, start, duration) {
      var shape = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'logarithmic';

      if (type === _fadeMaker.FADEIN) {
        (0, _fadeMaker.createFadeIn)(this.fadeGain.gain, shape, start, duration);
      } else if (type === _fadeMaker.FADEOUT) {
        (0, _fadeMaker.createFadeOut)(this.fadeGain.gain, shape, start, duration);
      } else {
        throw new Error('Unsupported fade type');
      }
    }
  }, {
    key: 'applyFadeIn',
    value: function applyFadeIn(start, duration) {
      var shape = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'logarithmic';

      this.applyFade(_fadeMaker.FADEIN, start, duration, shape);
    }
  }, {
    key: 'applyFadeOut',
    value: function applyFadeOut(start, duration) {
      var shape = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'logarithmic';

      this.applyFade(_fadeMaker.FADEOUT, start, duration, shape);
    }
  }, {
    key: 'isPlaying',
    value: function isPlaying() {
      return this.source !== undefined;
    }
  }, {
    key: 'getDuration',
    value: function getDuration() {
      return this.buffer.duration;
    }
  }, {
    key: 'setAudioContext',
    value: function setAudioContext(audioContext) {
      this.ac = audioContext;
      this.destination = this.ac.destination;
    }
  }, {
    key: 'setUpSource',
    value: function setUpSource() {
      var _this = this;

      this.source = this.ac.createBufferSource();
      this.source.buffer = this.buffer;

      var sourcePromise = new Promise(function (resolve) {
        // keep track of the buffer state.
        _this.source.onended = function () {
          _this.source.disconnect();
          _this.fadeGain.disconnect();
          _this.volumeGain.disconnect();
          _this.shouldPlayGain.disconnect();
          _this.masterGain.disconnect();

          _this.source = undefined;
          _this.fadeGain = undefined;
          _this.volumeGain = undefined;
          _this.shouldPlayGain = undefined;
          _this.masterGain = undefined;

          resolve();
        };
      });

      this.fadeGain = this.ac.createGain();
      // used for track volume slider
      this.volumeGain = this.ac.createGain();
      // used for solo/mute
      this.shouldPlayGain = this.ac.createGain();
      this.masterGain = this.ac.createGain();

      this.source.connect(this.fadeGain);
      this.fadeGain.connect(this.volumeGain);
      this.volumeGain.connect(this.shouldPlayGain);
      this.shouldPlayGain.connect(this.masterGain);
      this.masterGain.connect(this.destination);

      return sourcePromise;
    }
  }, {
    key: 'setVolumeGainLevel',
    value: function setVolumeGainLevel(level) {
      if (this.volumeGain) {
        this.volumeGain.gain.value = level;
      }
    }
  }, {
    key: 'setShouldPlay',
    value: function setShouldPlay(bool) {
      if (this.shouldPlayGain) {
        this.shouldPlayGain.gain.value = bool ? 1 : 0;
      }
    }
  }, {
    key: 'setMasterGainLevel',
    value: function setMasterGainLevel(level) {
      if (this.masterGain) {
        this.masterGain.gain.value = level;
      }
    }

    /*
      source.start is picky when passing the end time.
      If rounding error causes a number to make the source think
      it is playing slightly more samples than it has it won't play at all.
      Unfortunately it doesn't seem to work if you just give it a start time.
    */

  }, {
    key: 'play',
    value: function play(when, start, duration) {
      this.source.start(when, start, duration);
    }
  }, {
    key: 'stop',
    value: function stop() {
      var when = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      if (this.source) {
        this.source.stop(when);
      }
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"fade-maker":25}],69:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _h = require('virtual-dom/h');

var _h2 = _interopRequireDefault(_h);

var _conversions = require('./utils/conversions');

var _TimeScaleHook = require('./render/TimeScaleHook');

var _TimeScaleHook2 = _interopRequireDefault(_TimeScaleHook);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TimeScale = function () {
  function TimeScale(duration, offset, samplesPerPixel, sampleRate) {
    var marginLeft = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

    _classCallCheck(this, TimeScale);

    this.duration = duration;
    this.offset = offset;
    this.samplesPerPixel = samplesPerPixel;
    this.sampleRate = sampleRate;
    this.marginLeft = marginLeft;

    this.timeinfo = {
      20000: {
        marker: 30000,
        bigStep: 10000,
        smallStep: 5000,
        secondStep: 5
      },
      12000: {
        marker: 15000,
        bigStep: 5000,
        smallStep: 1000,
        secondStep: 1
      },
      10000: {
        marker: 10000,
        bigStep: 5000,
        smallStep: 1000,
        secondStep: 1
      },
      5000: {
        marker: 5000,
        bigStep: 1000,
        smallStep: 500,
        secondStep: 1 / 2
      },
      2500: {
        marker: 2000,
        bigStep: 1000,
        smallStep: 500,
        secondStep: 1 / 2
      },
      1500: {
        marker: 2000,
        bigStep: 1000,
        smallStep: 200,
        secondStep: 1 / 5
      },
      700: {
        marker: 1000,
        bigStep: 500,
        smallStep: 100,
        secondStep: 1 / 10
      }
    };
  }

  _createClass(TimeScale, [{
    key: 'getScaleInfo',
    value: function getScaleInfo(resolution) {
      var keys = Object.keys(this.timeinfo).map(function (item) {
        return parseInt(item, 10);
      });

      // make sure keys are numerically sorted.
      keys = keys.sort(function (a, b) {
        return a - b;
      });

      for (var i = 0; i < keys.length; i += 1) {
        if (resolution <= keys[i]) {
          return this.timeinfo[keys[i]];
        }
      }

      return this.timeinfo[keys[0]];
    }

    /*
      Return time in format mm:ss
    */

  }, {
    key: 'render',
    value: function render() {
      var widthX = (0, _conversions.secondsToPixels)(this.duration, this.samplesPerPixel, this.sampleRate);
      var pixPerSec = this.sampleRate / this.samplesPerPixel;
      var pixOffset = (0, _conversions.secondsToPixels)(this.offset, this.samplesPerPixel, this.sampleRate);
      var scaleInfo = this.getScaleInfo(this.samplesPerPixel);
      var canvasInfo = {};
      var timeMarkers = [];
      var end = widthX + pixOffset;
      var counter = 0;

      for (var i = 0; i < end; i += pixPerSec * scaleInfo.secondStep) {
        var pixIndex = Math.floor(i);
        var pix = pixIndex - pixOffset;

        if (pixIndex >= pixOffset) {
          // put a timestamp every 30 seconds.
          if (scaleInfo.marker && counter % scaleInfo.marker === 0) {
            timeMarkers.push((0, _h2.default)('div.time', {
              attributes: {
                style: 'position: absolute; left: ' + pix + 'px;'
              }
            }, [TimeScale.formatTime(counter)]));

            canvasInfo[pix] = 10;
          } else if (scaleInfo.bigStep && counter % scaleInfo.bigStep === 0) {
            canvasInfo[pix] = 5;
          } else if (scaleInfo.smallStep && counter % scaleInfo.smallStep === 0) {
            canvasInfo[pix] = 2;
          }
        }

        counter += 1000 * scaleInfo.secondStep;
      }

      return (0, _h2.default)('div.playlist-time-scale', {
        attributes: {
          style: 'position: relative; left: 0; right: 0; margin-left: ' + this.marginLeft + 'px;'
        }
      }, [timeMarkers, (0, _h2.default)('canvas', {
        attributes: {
          width: widthX,
          height: 30,
          style: 'position: absolute; left: 0; right: 0; top: 0; bottom: 0;'
        },
        hook: new _TimeScaleHook2.default(canvasInfo, this.offset, this.samplesPerPixel, this.duration)
      })]);
    }
  }], [{
    key: 'formatTime',
    value: function formatTime(milliseconds) {
      var seconds = milliseconds / 1000;
      var s = seconds % 60;
      var m = (seconds - s) / 60;

      if (s < 10) {
        s = '0' + s;
      }

      return m + ':' + s;
    }
  }]);

  return TimeScale;
}();

exports.default = TimeScale;
},{"./render/TimeScaleHook":80,"./utils/conversions":92,"virtual-dom/h":43}],70:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash.assign');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.forown');

var _lodash4 = _interopRequireDefault(_lodash3);

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _h = require('virtual-dom/h');

var _h2 = _interopRequireDefault(_h);

var _webaudioPeaks = require('webaudio-peaks');

var _webaudioPeaks2 = _interopRequireDefault(_webaudioPeaks);

var _fadeMaker = require('fade-maker');

var _conversions = require('./utils/conversions');

var _states = require('./track/states');

var _states2 = _interopRequireDefault(_states);

var _CanvasHook = require('./render/CanvasHook');

var _CanvasHook2 = _interopRequireDefault(_CanvasHook);

var _FadeCanvasHook = require('./render/FadeCanvasHook');

var _FadeCanvasHook2 = _interopRequireDefault(_FadeCanvasHook);

var _VolumeSliderHook = require('./render/VolumeSliderHook');

var _VolumeSliderHook2 = _interopRequireDefault(_VolumeSliderHook);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MAX_CANVAS_WIDTH = 1000;

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.name = 'Untitled';
    this.customClass = undefined;
    this.waveOutlineColor = undefined;
    this.gain = 1;
    this.fades = {};
    this.peakData = {
      type: 'WebAudio',
      mono: false
    };

    this.cueIn = 0;
    this.cueOut = 0;
    this.duration = 0;
    this.startTime = 0;
    this.endTime = 0;
  }

  _createClass(_class, [{
    key: 'setEventEmitter',
    value: function setEventEmitter(ee) {
      this.ee = ee;
    }
  }, {
    key: 'setName',
    value: function setName(name) {
      this.name = name;
    }
  }, {
    key: 'setCustomClass',
    value: function setCustomClass(className) {
      this.customClass = className;
    }
  }, {
    key: 'setWaveOutlineColor',
    value: function setWaveOutlineColor(color) {
      this.waveOutlineColor = color;
    }
  }, {
    key: 'setCues',
    value: function setCues(cueIn, cueOut) {
      if (cueOut < cueIn) {
        throw new Error('cue out cannot be less than cue in');
      }

      this.cueIn = cueIn;
      this.cueOut = cueOut;
      this.duration = this.cueOut - this.cueIn;
      this.endTime = this.startTime + this.duration;
    }

    /*
    *   start, end in seconds relative to the entire playlist.
    */

  }, {
    key: 'trim',
    value: function trim(start, end) {
      var trackStart = this.getStartTime();
      var trackEnd = this.getEndTime();
      var offset = this.cueIn - trackStart;

      if (trackStart <= start && trackEnd >= start || trackStart <= end && trackEnd >= end) {
        var cueIn = start < trackStart ? trackStart : start;
        var cueOut = end > trackEnd ? trackEnd : end;

        this.setCues(cueIn + offset, cueOut + offset);
        if (start > trackStart) {
          this.setStartTime(start);
        }
      }
    }
  }, {
    key: 'setStartTime',
    value: function setStartTime(start) {
      this.startTime = start;
      this.endTime = start + this.duration;
    }
  }, {
    key: 'setPlayout',
    value: function setPlayout(playout) {
      this.playout = playout;
    }
  }, {
    key: 'setOfflinePlayout',
    value: function setOfflinePlayout(playout) {
      this.offlinePlayout = playout;
    }
  }, {
    key: 'setEnabledStates',
    value: function setEnabledStates() {
      var enabledStates = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var defaultStatesEnabled = {
        cursor: true,
        fadein: true,
        fadeout: true,
        select: true,
        shift: true
      };

      this.enabledStates = (0, _lodash2.default)({}, defaultStatesEnabled, enabledStates);
    }
  }, {
    key: 'setFadeIn',
    value: function setFadeIn(duration) {
      var shape = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'logarithmic';

      if (duration > this.duration) {
        throw new Error('Invalid Fade In');
      }

      var fade = {
        shape: shape,
        start: 0,
        end: duration
      };

      if (this.fadeIn) {
        this.removeFade(this.fadeIn);
        this.fadeIn = undefined;
      }

      this.fadeIn = this.saveFade(_fadeMaker.FADEIN, fade.shape, fade.start, fade.end);
    }
  }, {
    key: 'setFadeOut',
    value: function setFadeOut(duration) {
      var shape = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'logarithmic';

      if (duration > this.duration) {
        throw new Error('Invalid Fade Out');
      }

      var fade = {
        shape: shape,
        start: this.duration - duration,
        end: this.duration
      };

      if (this.fadeOut) {
        this.removeFade(this.fadeOut);
        this.fadeOut = undefined;
      }

      this.fadeOut = this.saveFade(_fadeMaker.FADEOUT, fade.shape, fade.start, fade.end);
    }
  }, {
    key: 'saveFade',
    value: function saveFade(type, shape, start, end) {
      var id = _uuid2.default.v4();

      this.fades[id] = {
        type: type,
        shape: shape,
        start: start,
        end: end
      };

      return id;
    }
  }, {
    key: 'removeFade',
    value: function removeFade(id) {
      delete this.fades[id];
    }
  }, {
    key: 'setBuffer',
    value: function setBuffer(buffer) {
      this.buffer = buffer;
    }
  }, {
    key: 'setPeakData',
    value: function setPeakData(data) {
      this.peakData = data;
    }
  }, {
    key: 'calculatePeaks',
    value: function calculatePeaks(samplesPerPixel, sampleRate) {
      var cueIn = (0, _conversions.secondsToSamples)(this.cueIn, sampleRate);
      var cueOut = (0, _conversions.secondsToSamples)(this.cueOut, sampleRate);

      this.setPeaks((0, _webaudioPeaks2.default)(this.buffer, samplesPerPixel, this.peakData.mono, cueIn, cueOut));
    }
  }, {
    key: 'setPeaks',
    value: function setPeaks(peaks) {
      this.peaks = peaks;
    }
  }, {
    key: 'setState',
    value: function setState(state) {
      this.state = state;

      if (this.state && this.enabledStates[this.state]) {
        var StateClass = _states2.default[this.state];
        this.stateObj = new StateClass(this);
      } else {
        this.stateObj = undefined;
      }
    }
  }, {
    key: 'getStartTime',
    value: function getStartTime() {
      return this.startTime;
    }
  }, {
    key: 'getEndTime',
    value: function getEndTime() {
      return this.endTime;
    }
  }, {
    key: 'getDuration',
    value: function getDuration() {
      return this.duration;
    }
  }, {
    key: 'isPlaying',
    value: function isPlaying() {
      return this.playout.isPlaying();
    }
  }, {
    key: 'setShouldPlay',
    value: function setShouldPlay(bool) {
      this.playout.setShouldPlay(bool);
    }
  }, {
    key: 'setGainLevel',
    value: function setGainLevel(level) {
      this.gain = level;
      this.playout.setVolumeGainLevel(level);
    }
  }, {
    key: 'setMasterGainLevel',
    value: function setMasterGainLevel(level) {
      this.playout.setMasterGainLevel(level);
    }

    /*
      startTime, endTime in seconds (float).
      segment is for a highlighted section in the UI.
       returns a Promise that will resolve when the AudioBufferSource
      is either stopped or plays out naturally.
    */

  }, {
    key: 'schedulePlay',
    value: function schedulePlay(now, startTime, endTime, config) {
      var start = void 0;
      var duration = void 0;
      var when = now;
      var segment = endTime ? endTime - startTime : undefined;

      var defaultOptions = {
        shouldPlay: true,
        masterGain: 1,
        isOffline: false
      };

      var options = (0, _lodash2.default)({}, defaultOptions, config);
      var playoutSystem = options.isOffline ? this.offlinePlayout : this.playout;

      // 1) track has no content to play.
      // 2) track does not play in this selection.
      if (this.endTime <= startTime || segment && startTime + segment < this.startTime) {
        // return a resolved promise since this track is technically "stopped".
        return Promise.resolve();
      }

      // track should have something to play if it gets here.

      // the track starts in the future or on the cursor position
      if (this.startTime >= startTime) {
        start = 0;
        // schedule additional delay for this audio node.
        when += this.startTime - startTime;

        if (endTime) {
          segment -= this.startTime - startTime;
          duration = Math.min(segment, this.duration);
        } else {
          duration = this.duration;
        }
      } else {
        start = startTime - this.startTime;

        if (endTime) {
          duration = Math.min(segment, this.duration - start);
        } else {
          duration = this.duration - start;
        }
      }

      start += this.cueIn;
      var relPos = startTime - this.startTime;
      var sourcePromise = playoutSystem.setUpSource();

      // param relPos: cursor position in seconds relative to this track.
      // can be negative if the cursor is placed before the start of this track etc.
      (0, _lodash4.default)(this.fades, function (fade) {
        var fadeStart = void 0;
        var fadeDuration = void 0;

        // only apply fade if it's ahead of the cursor.
        if (relPos < fade.end) {
          if (relPos <= fade.start) {
            fadeStart = now + (fade.start - relPos);
            fadeDuration = fade.end - fade.start;
          } else if (relPos > fade.start && relPos < fade.end) {
            fadeStart = now - (relPos - fade.start);
            fadeDuration = fade.end - fade.start;
          }

          switch (fade.type) {
            case _fadeMaker.FADEIN:
              {
                playoutSystem.applyFadeIn(fadeStart, fadeDuration, fade.shape);
                break;
              }
            case _fadeMaker.FADEOUT:
              {
                playoutSystem.applyFadeOut(fadeStart, fadeDuration, fade.shape);
                break;
              }
            default:
              {
                throw new Error('Invalid fade type saved on track.');
              }
          }
        }
      });

      playoutSystem.setVolumeGainLevel(this.gain);
      playoutSystem.setShouldPlay(options.shouldPlay);
      playoutSystem.setMasterGainLevel(options.masterGain);
      playoutSystem.play(when, start, duration);

      return sourcePromise;
    }
  }, {
    key: 'scheduleStop',
    value: function scheduleStop() {
      var when = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      this.playout.stop(when);
    }
  }, {
    key: 'renderOverlay',
    value: function renderOverlay(data) {
      var _this = this;

      var channelPixels = (0, _conversions.secondsToPixels)(data.playlistLength, data.resolution, data.sampleRate);

      var config = {
        attributes: {
          style: 'position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: ' + channelPixels + 'px; z-index: 9;'
        }
      };

      var overlayClass = '';

      if (this.stateObj) {
        this.stateObj.setup(data.resolution, data.sampleRate);
        var StateClass = _states2.default[this.state];
        var events = StateClass.getEvents();

        events.forEach(function (event) {
          config['on' + event] = _this.stateObj[event].bind(_this.stateObj);
        });

        overlayClass = StateClass.getClass();
      }
      // use this overlay for track event cursor position calculations.
      return (0, _h2.default)('div.playlist-overlay' + overlayClass, config);
    }
  }, {
    key: 'renderControls',
    value: function renderControls(data) {
      var _this2 = this;

      var muteClass = data.muted ? '.active' : '';
      var soloClass = data.soloed ? '.active' : '';
      var numChan = this.peaks.data.length;

      return (0, _h2.default)('div.controls', {
        attributes: {
          style: 'height: ' + numChan * data.height + 'px; width: ' + data.controls.width + 'px; position: absolute; left: 0; z-index: 10;'
        }
      }, [(0, _h2.default)('header', [this.name]), (0, _h2.default)('div.btn-group', [(0, _h2.default)('span.btn.btn-default.btn-xs.btn-mute' + muteClass, {
        onclick: function onclick() {
          _this2.ee.emit('mute', _this2);
        }
      }, ['Mute']), (0, _h2.default)('span.btn.btn-default.btn-xs.btn-solo' + soloClass, {
        onclick: function onclick() {
          _this2.ee.emit('solo', _this2);
        }
      }, ['Solo'])]), (0, _h2.default)('label', [(0, _h2.default)('input.volume-slider', {
        attributes: {
          type: 'range',
          min: 0,
          max: 100,
          value: 100
        },
        hook: new _VolumeSliderHook2.default(this.gain),
        oninput: function oninput(e) {
          _this2.ee.emit('volumechange', e.target.value, _this2);
        }
      })])]);
    }
  }, {
    key: 'render',
    value: function render(data) {
      var _this3 = this;

      var width = this.peaks.length;
      var playbackX = (0, _conversions.secondsToPixels)(data.playbackSeconds, data.resolution, data.sampleRate);
      var startX = (0, _conversions.secondsToPixels)(this.startTime, data.resolution, data.sampleRate);
      var endX = (0, _conversions.secondsToPixels)(this.endTime, data.resolution, data.sampleRate);
      var progressWidth = 0;
      var numChan = this.peaks.data.length;

      if (playbackX > 0 && playbackX > startX) {
        if (playbackX < endX) {
          progressWidth = playbackX - startX;
        } else {
          progressWidth = width;
        }
      }

      var waveformChildren = [(0, _h2.default)('div.cursor', {
        attributes: {
          style: 'position: absolute; width: 1px; margin: 0; padding: 0; top: 0; left: ' + playbackX + 'px; bottom: 0; z-index: 5;'
        }
      })];

      var channels = Object.keys(this.peaks.data).map(function (channelNum) {
        var channelChildren = [(0, _h2.default)('div.channel-progress', {
          attributes: {
            style: 'position: absolute; width: ' + progressWidth + 'px; height: ' + data.height + 'px; z-index: 2;'
          }
        })];
        var offset = 0;
        var totalWidth = width;
        var peaks = _this3.peaks.data[channelNum];

        while (totalWidth > 0) {
          var currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);
          var canvasColor = _this3.waveOutlineColor ? _this3.waveOutlineColor : data.colors.waveOutlineColor;

          channelChildren.push((0, _h2.default)('canvas', {
            attributes: {
              width: currentWidth,
              height: data.height,
              style: 'float: left; position: relative; margin: 0; padding: 0; z-index: 3;'
            },
            hook: new _CanvasHook2.default(peaks, offset, _this3.peaks.bits, canvasColor)
          }));

          totalWidth -= currentWidth;
          offset += MAX_CANVAS_WIDTH;
        }

        // if there are fades, display them.
        if (_this3.fadeIn) {
          var fadeIn = _this3.fades[_this3.fadeIn];
          var fadeWidth = (0, _conversions.secondsToPixels)(fadeIn.end - fadeIn.start, data.resolution, data.sampleRate);

          channelChildren.push((0, _h2.default)('div.wp-fade.wp-fadein', {
            attributes: {
              style: 'position: absolute; height: ' + data.height + 'px; width: ' + fadeWidth + 'px; top: 0; left: 0; z-index: 4;'
            }
          }, [(0, _h2.default)('canvas', {
            attributes: {
              width: fadeWidth,
              height: data.height
            },
            hook: new _FadeCanvasHook2.default(fadeIn.type, fadeIn.shape, fadeIn.end - fadeIn.start, data.resolution)
          })]));
        }

        if (_this3.fadeOut) {
          var fadeOut = _this3.fades[_this3.fadeOut];
          var _fadeWidth = (0, _conversions.secondsToPixels)(fadeOut.end - fadeOut.start, data.resolution, data.sampleRate);

          channelChildren.push((0, _h2.default)('div.wp-fade.wp-fadeout', {
            attributes: {
              style: 'position: absolute; height: ' + data.height + 'px; width: ' + _fadeWidth + 'px; top: 0; right: 0; z-index: 4;'
            }
          }, [(0, _h2.default)('canvas', {
            attributes: {
              width: _fadeWidth,
              height: data.height
            },
            hook: new _FadeCanvasHook2.default(fadeOut.type, fadeOut.shape, fadeOut.end - fadeOut.start, data.resolution)
          })]));
        }

        return (0, _h2.default)('div.channel.channel-' + channelNum, {
          attributes: {
            style: 'height: ' + data.height + 'px; width: ' + width + 'px; top: ' + channelNum * data.height + 'px; left: ' + startX + 'px; position: absolute; margin: 0; padding: 0; z-index: 1;'
          }
        }, channelChildren);
      });

      waveformChildren.push(channels);
      waveformChildren.push(this.renderOverlay(data));

      // draw cursor selection on active track.
      if (data.isActive === true) {
        var cStartX = (0, _conversions.secondsToPixels)(data.timeSelection.start, data.resolution, data.sampleRate);
        var cEndX = (0, _conversions.secondsToPixels)(data.timeSelection.end, data.resolution, data.sampleRate);
        var cWidth = cEndX - cStartX + 1;
        var cClassName = cWidth > 1 ? '.segment' : '.point';

        waveformChildren.push((0, _h2.default)('div.selection' + cClassName, {
          attributes: {
            style: 'position: absolute; width: ' + cWidth + 'px; bottom: 0; top: 0; left: ' + cStartX + 'px; z-index: 4;'
          }
        }));
      }

      var waveform = (0, _h2.default)('div.waveform', {
        attributes: {
          style: 'height: ' + numChan * data.height + 'px; position: relative;'
        }
      }, waveformChildren);

      var channelChildren = [];
      var channelMargin = 0;

      if (data.controls.show) {
        channelChildren.push(this.renderControls(data));
        channelMargin = data.controls.width;
      }

      channelChildren.push(waveform);

      var audibleClass = data.shouldPlay ? '' : '.silent';
      var customClass = this.customClass === undefined ? '' : '.' + this.customClass;

      return (0, _h2.default)('div.channel-wrapper' + audibleClass + customClass, {
        attributes: {
          style: 'margin-left: ' + channelMargin + 'px; height: ' + data.height * numChan + 'px;'
        }
      }, channelChildren);
    }
  }, {
    key: 'getTrackDetails',
    value: function getTrackDetails() {
      var info = {
        src: this.src,
        start: this.startTime,
        end: this.endTime,
        name: this.name,
        customClass: this.customClass,
        cuein: this.cueIn,
        cueout: this.cueOut
      };

      if (this.fadeIn) {
        var fadeIn = this.fades[this.fadeIn];

        info.fadeIn = {
          shape: fadeIn.shape,
          duration: fadeIn.end - fadeIn.start
        };
      }

      if (this.fadeOut) {
        var fadeOut = this.fades[this.fadeOut];

        info.fadeOut = {
          shape: fadeOut.shape,
          duration: fadeOut.end - fadeOut.start
        };
      }

      return info;
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"./render/CanvasHook":77,"./render/FadeCanvasHook":78,"./render/VolumeSliderHook":81,"./track/states":86,"./utils/conversions":92,"fade-maker":25,"lodash.assign":33,"lodash.forown":35,"uuid":97,"virtual-dom/h":43,"webaudio-peaks":98}],71:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _h = require('virtual-dom/h');

var _h2 = _interopRequireDefault(_h);

var _aeneas = require('./input/aeneas');

var _aeneas2 = _interopRequireDefault(_aeneas);

var _aeneas3 = require('./output/aeneas');

var _aeneas4 = _interopRequireDefault(_aeneas3);

var _conversions = require('../utils/conversions');

var _DragInteraction = require('../interaction/DragInteraction');

var _DragInteraction2 = _interopRequireDefault(_DragInteraction);

var _ScrollTopHook = require('./render/ScrollTopHook');

var _ScrollTopHook2 = _interopRequireDefault(_ScrollTopHook);

var _timeformat = require('../utils/timeformat');

var _timeformat2 = _interopRequireDefault(_timeformat);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AnnotationList = function () {
  function AnnotationList(playlist, annotations) {
    var controls = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    var editable = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var linkEndpoints = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
    var isContinuousPlay = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;

    _classCallCheck(this, AnnotationList);

    this.playlist = playlist;
    this.resizeHandlers = [];
    this.editable = editable;
    this.annotations = annotations.map(function (a) {
      return (
        // TODO support different formats later on.
        (0, _aeneas2.default)(a)
      );
    });
    this.setupInteractions();

    this.controls = controls;
    this.setupEE(playlist.ee);

    // TODO actually make a real plugin system that's not terrible.
    this.playlist.isContinuousPlay = isContinuousPlay;
    this.playlist.linkEndpoints = linkEndpoints;
    this.length = this.annotations.length;
  }

  _createClass(AnnotationList, [{
    key: 'setupInteractions',
    value: function setupInteractions() {
      var _this = this;

      this.annotations.forEach(function (a, i) {
        var leftShift = new _DragInteraction2.default(_this.playlist, {
          direction: 'left',
          index: i
        });
        var rightShift = new _DragInteraction2.default(_this.playlist, {
          direction: 'right',
          index: i
        });

        _this.resizeHandlers.push(leftShift);
        _this.resizeHandlers.push(rightShift);
      });
    }
  }, {
    key: 'setupEE',
    value: function setupEE(ee) {
      var _this2 = this;

      ee.on('dragged', function (deltaTime, data) {
        var annotationIndex = data.index;
        var annotations = _this2.annotations;
        var note = annotations[annotationIndex];

        // resizing to the left
        if (data.direction === 'left') {
          var originalVal = note.start;
          note.start += deltaTime;

          if (note.start < 0) {
            note.start = 0;
          }

          if (annotationIndex && annotations[annotationIndex - 1].end > note.start) {
            annotations[annotationIndex - 1].end = note.start;
          }

          if (_this2.playlist.linkEndpoints && annotationIndex && annotations[annotationIndex - 1].end === originalVal) {
            annotations[annotationIndex - 1].end = note.start;
          }
        } else {
          // resizing to the right
          var _originalVal = note.end;
          note.end += deltaTime;

          if (note.end > _this2.playlist.duration) {
            note.end = _this2.playlist.duration;
          }

          if (annotationIndex < annotations.length - 1 && annotations[annotationIndex + 1].start < note.end) {
            annotations[annotationIndex + 1].start = note.end;
          }

          if (_this2.playlist.linkEndpoints && annotationIndex < annotations.length - 1 && annotations[annotationIndex + 1].start === _originalVal) {
            annotations[annotationIndex + 1].start = note.end;
          }
        }

        _this2.playlist.drawRequest();
      });

      ee.on('continuousplay', function (val) {
        _this2.playlist.isContinuousPlay = val;
      });

      ee.on('linkendpoints', function (val) {
        _this2.playlist.linkEndpoints = val;
      });

      ee.on('annotationsrequest', function () {
        _this2.export();
      });

      return ee;
    }
  }, {
    key: 'export',
    value: function _export() {
      var output = this.annotations.map(function (a) {
        return (0, _aeneas4.default)(a);
      });
      var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(output));
      var a = document.createElement('a');

      document.body.appendChild(a);
      a.href = dataStr;
      a.download = 'annotations.json';
      a.click();
      document.body.removeChild(a);
    }
  }, {
    key: 'renderResizeLeft',
    value: function renderResizeLeft(i) {
      var events = _DragInteraction2.default.getEvents();
      var config = { attributes: {
          style: 'position: absolute; height: 30px; width: 10px; top: 0; left: -2px',
          draggable: true
        } };
      var handler = this.resizeHandlers[i * 2];

      events.forEach(function (event) {
        config['on' + event] = handler[event].bind(handler);
      });

      return (0, _h2.default)('div.resize-handle.resize-w', config);
    }
  }, {
    key: 'renderResizeRight',
    value: function renderResizeRight(i) {
      var events = _DragInteraction2.default.getEvents();
      var config = { attributes: {
          style: 'position: absolute; height: 30px; width: 10px; top: 0; right: -2px',
          draggable: true
        } };
      var handler = this.resizeHandlers[i * 2 + 1];

      events.forEach(function (event) {
        config['on' + event] = handler[event].bind(handler);
      });

      return (0, _h2.default)('div.resize-handle.resize-e', config);
    }
  }, {
    key: 'renderControls',
    value: function renderControls(note, i) {
      var _this3 = this;

      // seems to be a bug with references, or I'm missing something.
      var that = this;
      return this.controls.map(function (ctrl) {
        return (0, _h2.default)('i.' + ctrl.class, {
          attributes: {
            title: ctrl.title
          },
          onclick: function onclick() {
            ctrl.action(note, i, that.annotations, {
              linkEndpoints: that.playlist.linkEndpoints
            });
            _this3.setupInteractions();
            that.playlist.drawRequest();
          }
        });
      });
    }
  }, {
    key: 'render',
    value: function render() {
      var _this4 = this;

      var boxes = (0, _h2.default)('div.annotations-boxes', {
        attributes: {
          style: 'height: 30px;'
        }
      }, this.annotations.map(function (note, i) {
        var samplesPerPixel = _this4.playlist.samplesPerPixel;
        var sampleRate = _this4.playlist.sampleRate;
        var pixPerSec = sampleRate / samplesPerPixel;
        var pixOffset = (0, _conversions.secondsToPixels)(_this4.playlist.scrollLeft, samplesPerPixel, sampleRate);
        var left = Math.floor(note.start * pixPerSec - pixOffset);
        var width = Math.ceil(note.end * pixPerSec - note.start * pixPerSec);

        return (0, _h2.default)('div.annotation-box', {
          attributes: {
            style: 'position: absolute; height: 30px; width: ' + width + 'px; left: ' + left + 'px',
            'data-id': note.id
          }
        }, [_this4.renderResizeLeft(i), (0, _h2.default)('span.id', {
          onclick: function onclick() {
            if (_this4.playlist.isContinuousPlay) {
              _this4.playlist.ee.emit('play', _this4.annotations[i].start);
            } else {
              _this4.playlist.ee.emit('play', _this4.annotations[i].start, _this4.annotations[i].end);
            }
          }
        }, [note.id]), _this4.renderResizeRight(i)]);
      }));

      var boxesWrapper = (0, _h2.default)('div.annotations-boxes-wrapper', {
        attributes: {
          style: 'overflow: hidden;'
        }
      }, [boxes]);

      var text = (0, _h2.default)('div.annotations-text', {
        hook: new _ScrollTopHook2.default()
      }, this.annotations.map(function (note, i) {
        var format = (0, _timeformat2.default)(_this4.playlist.durationFormat);
        var start = format(note.start);
        var end = format(note.end);

        var segmentClass = '';
        if (_this4.playlist.isPlaying() && _this4.playlist.playbackSeconds >= note.start && _this4.playlist.playbackSeconds <= note.end) {
          segmentClass = '.current';
        }

        var editableConfig = {
          attributes: {
            contenteditable: true
          },
          oninput: function oninput(e) {
            // needed currently for references
            // eslint-disable-next-line no-param-reassign
            note.lines = [e.target.innerText];
          },
          onkeypress: function onkeypress(e) {
            if (e.which === 13 || e.keyCode === 13) {
              e.target.blur();
              e.preventDefault();
            }
          }
        };

        var linesConfig = _this4.editable ? editableConfig : {};

        return (0, _h2.default)('div.annotation' + segmentClass, [(0, _h2.default)('span.annotation-id', [note.id]), (0, _h2.default)('span.annotation-start', [start]), (0, _h2.default)('span.annotation-end', [end]), (0, _h2.default)('span.annotation-lines', linesConfig, [note.lines]), (0, _h2.default)('span.annotation-actions', _this4.renderControls(note, i))]);
      }));

      return (0, _h2.default)('div.annotations', [boxesWrapper, text]);
    }
  }]);

  return AnnotationList;
}();

exports.default = AnnotationList;
},{"../interaction/DragInteraction":76,"../utils/conversions":92,"../utils/timeformat":95,"./input/aeneas":72,"./output/aeneas":73,"./render/ScrollTopHook":74,"virtual-dom/h":43}],72:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (aeneas) {
  var annotation = {
    id: aeneas.id || _uuid2.default.v4(),
    start: Number(aeneas.begin) || 0,
    end: Number(aeneas.end) || 0,
    lines: aeneas.lines || [''],
    lang: aeneas.language || 'en'
  };

  return annotation;
};

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
},{"uuid":97}],73:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (annotation) {
  return {
    begin: String(annotation.start.toFixed(3)),
    end: String(annotation.end.toFixed(3)),
    id: String(annotation.id),
    language: annotation.lang,
    lines: annotation.lines
  };
};
},{}],74:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/*
* virtual-dom hook for scrolling to the text annotation.
*/
var Hook = function ScrollTopHook() {};
Hook.prototype.hook = function hook(node) {
  var el = node.querySelector('.current');
  if (el) {
    var box = node.getBoundingClientRect();
    var row = el.getBoundingClientRect();
    var diff = row.top - box.top;
    var list = node;
    list.scrollTop += diff;
  }
};

exports.default = Hook;
},{}],75:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = init;

exports.default = function () {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var ee = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : (0, _eventEmitter2.default)();

  return init(options, ee);
};

var _lodash = require('lodash.assign');

var _lodash2 = _interopRequireDefault(_lodash);

var _createElement = require('virtual-dom/create-element');

var _createElement2 = _interopRequireDefault(_createElement);

var _eventEmitter = require('event-emitter');

var _eventEmitter2 = _interopRequireDefault(_eventEmitter);

var _Playlist = require('./Playlist');

var _Playlist2 = _interopRequireDefault(_Playlist);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function init() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var ee = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : (0, _eventEmitter2.default)();

  if (options.container === undefined) {
    throw new Error('DOM element container must be given.');
  }

  window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  window.AudioContext = window.AudioContext || window.webkitAudioContext;

  var audioContext = new window.AudioContext();

  var defaults = {
    ac: audioContext,
    sampleRate: audioContext.sampleRate,
    samplesPerPixel: 4096,
    mono: true,
    fadeType: 'logarithmic',
    exclSolo: false,
    timescale: false,
    controls: {
      show: false,
      width: 150
    },
    colors: {
      waveOutlineColor: 'white',
      timeColor: 'grey',
      fadeColor: 'black'
    },
    seekStyle: 'line',
    waveHeight: 128,
    state: 'cursor',
    zoomLevels: [512, 1024, 2048, 4096],
    annotationList: {
      annotations: [],
      controls: [],
      editable: false,
      linkEndpoints: false,
      isContinuousPlay: false
    },
    isAutomaticScroll: false
  };

  var config = (0, _lodash2.default)(defaults, options);
  var zoomIndex = config.zoomLevels.indexOf(config.samplesPerPixel);

  if (zoomIndex === -1) {
    throw new Error('initial samplesPerPixel must be included in array zoomLevels');
  }

  var playlist = new _Playlist2.default();
  playlist.setSampleRate(config.sampleRate);
  playlist.setSamplesPerPixel(config.samplesPerPixel);
  playlist.setAudioContext(config.ac);
  playlist.setEventEmitter(ee);
  playlist.setUpEventEmitter();
  playlist.setTimeSelection(0, 0);
  playlist.setState(config.state);
  playlist.setControlOptions(config.controls);
  playlist.setWaveHeight(config.waveHeight);
  playlist.setColors(config.colors);
  playlist.setZoomLevels(config.zoomLevels);
  playlist.setZoomIndex(zoomIndex);
  playlist.setMono(config.mono);
  playlist.setExclSolo(config.exclSolo);
  playlist.setShowTimeScale(config.timescale);
  playlist.setSeekStyle(config.seekStyle);
  playlist.setAnnotations(config.annotationList);
  playlist.isAutomaticScroll = config.isAutomaticScroll;
  playlist.isContinuousPlay = config.isContinuousPlay;
  playlist.linkedEndpoints = config.linkedEndpoints;

  // take care of initial virtual dom rendering.
  var tree = playlist.render();
  var rootNode = (0, _createElement2.default)(tree);

  config.container.appendChild(rootNode);
  playlist.tree = tree;
  playlist.rootNode = rootNode;

  return playlist;
}
},{"./Playlist":67,"event-emitter":23,"lodash.assign":33,"virtual-dom/create-element":41}],76:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _conversions = require('../utils/conversions');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class(playlist) {
    var _this = this;

    var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, _class);

    this.playlist = playlist;
    this.data = data;
    this.active = false;

    this.ondragover = function (e) {
      if (_this.active) {
        e.preventDefault();
        _this.emitDrag(e.clientX);
      }
    };
  }

  _createClass(_class, [{
    key: 'emitDrag',
    value: function emitDrag(x) {
      var deltaX = x - this.prevX;

      // emit shift event if not 0
      if (deltaX) {
        var deltaTime = (0, _conversions.pixelsToSeconds)(deltaX, this.playlist.samplesPerPixel, this.playlist.sampleRate);
        this.prevX = x;
        this.playlist.ee.emit('dragged', deltaTime, this.data);
      }
    }
  }, {
    key: 'complete',
    value: function complete() {
      this.active = false;
      document.removeEventListener('dragover', this.ondragover);
    }
  }, {
    key: 'dragstart',
    value: function dragstart(e) {
      var ev = e;
      this.active = true;
      this.prevX = e.clientX;

      ev.dataTransfer.dropEffect = 'move';
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', '');
      document.addEventListener('dragover', this.ondragover);
    }
  }, {
    key: 'dragend',
    value: function dragend(e) {
      if (this.active) {
        e.preventDefault();
        this.complete();
      }
    }
  }], [{
    key: 'getClass',
    value: function getClass() {
      return '.shift';
    }
  }, {
    key: 'getEvents',
    value: function getEvents() {
      return ['dragstart', 'dragend'];
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"../utils/conversions":92}],77:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
* virtual-dom hook for drawing to the canvas element.
*/
var CanvasHook = function () {
  function CanvasHook(peaks, offset, bits, color) {
    _classCallCheck(this, CanvasHook);

    this.peaks = peaks;
    // http://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
    this.offset = offset;
    this.color = color;
    this.bits = bits;
  }

  _createClass(CanvasHook, [{
    key: 'hook',
    value: function hook(canvas, prop, prev) {
      // canvas is up to date
      if (prev !== undefined && prev.peaks === this.peaks) {
        return;
      }

      var len = canvas.width;
      var cc = canvas.getContext('2d');
      var h2 = canvas.height / 2;
      var maxValue = Math.pow(2, this.bits - 1);

      cc.clearRect(0, 0, canvas.width, canvas.height);
      cc.fillStyle = this.color;

      for (var i = 0; i < len; i += 1) {
        var minPeak = this.peaks[(i + this.offset) * 2] / maxValue;
        var maxPeak = this.peaks[(i + this.offset) * 2 + 1] / maxValue;
        CanvasHook.drawFrame(cc, h2, i, minPeak, maxPeak);
      }
    }
  }], [{
    key: 'drawFrame',
    value: function drawFrame(cc, h2, x, minPeak, maxPeak) {
      var min = Math.abs(minPeak * h2);
      var max = Math.abs(maxPeak * h2);

      // draw max
      cc.fillRect(x, 0, 1, h2 - max);
      // draw min
      cc.fillRect(x, h2 + min, 1, h2 - min);
    }
  }]);

  return CanvasHook;
}();

exports.default = CanvasHook;
},{}],78:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fadeMaker = require('fade-maker');

var _fadeCurves = require('fade-curves');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
* virtual-dom hook for drawing the fade curve to the canvas element.
*/
var FadeCanvasHook = function () {
  function FadeCanvasHook(type, shape, duration, samplesPerPixel) {
    _classCallCheck(this, FadeCanvasHook);

    this.type = type;
    this.shape = shape;
    this.duration = duration;
    this.samplesPerPixel = samplesPerPixel;
  }

  _createClass(FadeCanvasHook, [{
    key: 'hook',
    value: function hook(canvas, prop, prev) {
      // node is up to date.
      if (prev !== undefined && prev.shape === this.shape && prev.type === this.type && prev.duration === this.duration && prev.samplesPerPixel === this.samplesPerPixel) {
        return;
      }

      var ctx = canvas.getContext('2d');
      var width = canvas.width;
      var height = canvas.height;
      var curve = FadeCanvasHook.createCurve(this.shape, this.type, width);
      var len = curve.length;
      var y = height - curve[0] * height;

      ctx.strokeStyle = 'black';
      ctx.beginPath();
      ctx.moveTo(0, y);

      for (var i = 1; i < len; i += 1) {
        y = height - curve[i] * height;
        ctx.lineTo(i, y);
      }
      ctx.stroke();
    }
  }], [{
    key: 'createCurve',
    value: function createCurve(shape, type, width) {
      var reflection = void 0;
      var curve = void 0;

      switch (type) {
        case _fadeMaker.FADEIN:
          {
            reflection = 1;
            break;
          }
        case _fadeMaker.FADEOUT:
          {
            reflection = -1;
            break;
          }
        default:
          {
            throw new Error('Unsupported fade type.');
          }
      }

      switch (shape) {
        case _fadeMaker.SCURVE:
          {
            curve = (0, _fadeCurves.sCurve)(width, reflection);
            break;
          }
        case _fadeMaker.LINEAR:
          {
            curve = (0, _fadeCurves.linear)(width, reflection);
            break;
          }
        case _fadeMaker.EXPONENTIAL:
          {
            curve = (0, _fadeCurves.exponential)(width, reflection);
            break;
          }
        case _fadeMaker.LOGARITHMIC:
          {
            curve = (0, _fadeCurves.logarithmic)(width, 10, reflection);
            break;
          }
        default:
          {
            throw new Error('Unsupported fade shape');
          }
      }

      return curve;
    }
  }]);

  return FadeCanvasHook;
}();

exports.default = FadeCanvasHook;
},{"fade-curves":24,"fade-maker":25}],79:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _conversions = require('../utils/conversions');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
* virtual-dom hook for scrolling the track container.
*/
var _class = function () {
  function _class(playlist) {
    _classCallCheck(this, _class);

    this.playlist = playlist;
  }

  _createClass(_class, [{
    key: 'hook',
    value: function hook(node) {
      var playlist = this.playlist;
      if (!playlist.isScrolling) {
        var el = node;

        if (playlist.isAutomaticScroll) {
          var rect = node.getBoundingClientRect();
          var cursorRect = node.querySelector('.cursor').getBoundingClientRect();

          if (cursorRect.right > rect.right || cursorRect.right < 0) {
            playlist.scrollLeft = playlist.playbackSeconds;
          }
        }

        var left = (0, _conversions.secondsToPixels)(playlist.scrollLeft, playlist.samplesPerPixel, playlist.sampleRate);

        el.scrollLeft = left;
      }
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"../utils/conversions":92}],80:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
* virtual-dom hook for rendering the time scale canvas.
*/
var _class = function () {
  function _class(tickInfo, offset, samplesPerPixel, duration) {
    _classCallCheck(this, _class);

    this.tickInfo = tickInfo;
    this.offset = offset;
    this.samplesPerPixel = samplesPerPixel;
    this.duration = duration;
  }

  _createClass(_class, [{
    key: 'hook',
    value: function hook(canvas, prop, prev) {
      var _this = this;

      // canvas is up to date
      if (prev !== undefined && prev.offset === this.offset && prev.duration === this.duration && prev.samplesPerPixel === this.samplesPerPixel) {
        return;
      }

      var width = canvas.width;
      var height = canvas.height;
      var ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, width, height);

      Object.keys(this.tickInfo).forEach(function (x) {
        var scaleHeight = _this.tickInfo[x];
        var scaleY = height - scaleHeight;
        ctx.fillRect(x, scaleY, 1, scaleHeight);
      });
    }
  }]);

  return _class;
}();

exports.default = _class;
},{}],81:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
* virtual-dom hook for setting the volume input programmatically.
*/
var _class = function () {
  function _class(gain) {
    _classCallCheck(this, _class);

    this.gain = gain;
  }

  _createClass(_class, [{
    key: 'hook',
    value: function hook(volumeInput) {
      volumeInput.setAttribute('value', this.gain * 100);
    }
  }]);

  return _class;
}();

exports.default = _class;
},{}],82:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _Loader2 = require('./Loader');

var _Loader3 = _interopRequireDefault(_Loader2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _class = function (_Loader) {
  _inherits(_class, _Loader);

  function _class() {
    _classCallCheck(this, _class);

    return _possibleConstructorReturn(this, (_class.__proto__ || Object.getPrototypeOf(_class)).apply(this, arguments));
  }

  _createClass(_class, [{
    key: 'load',


    /*
    * Loads an audio file via a FileReader
    */
    value: function load() {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        if (_this2.src.type.match(/audio.*/) ||
        // added for problems with Firefox mime types + ogg.
        _this2.src.type.match(/video\/ogg/)) {
          var fr = new FileReader();

          fr.readAsArrayBuffer(_this2.src);

          fr.addEventListener('progress', function (e) {
            _get(_class.prototype.__proto__ || Object.getPrototypeOf(_class.prototype), 'fileProgress', _this2).call(_this2, e);
          });

          fr.addEventListener('load', function (e) {
            var decoderPromise = _get(_class.prototype.__proto__ || Object.getPrototypeOf(_class.prototype), 'fileLoad', _this2).call(_this2, e);

            decoderPromise.then(function (audioBuffer) {
              resolve(audioBuffer);
            });
          });

          fr.addEventListener('error', function (err) {
            reject(err);
          });
        } else {
          reject(Error('Unsupported file type ' + _this2.src.type));
        }
      });
    }
  }]);

  return _class;
}(_Loader3.default);

exports.default = _class;
},{"./Loader":83}],83:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.STATE_FINISHED = exports.STATE_DECODING = exports.STATE_LOADING = exports.STATE_UNINITIALIZED = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _eventEmitter = require('event-emitter');

var _eventEmitter2 = _interopRequireDefault(_eventEmitter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var STATE_UNINITIALIZED = exports.STATE_UNINITIALIZED = 0;
var STATE_LOADING = exports.STATE_LOADING = 1;
var STATE_DECODING = exports.STATE_DECODING = 2;
var STATE_FINISHED = exports.STATE_FINISHED = 3;

var _class = function () {
  function _class(src, audioContext) {
    var ee = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : (0, _eventEmitter2.default)();

    _classCallCheck(this, _class);

    this.src = src;
    this.ac = audioContext;
    this.audioRequestState = STATE_UNINITIALIZED;
    this.ee = ee;
  }

  _createClass(_class, [{
    key: 'setStateChange',
    value: function setStateChange(state) {
      this.audioRequestState = state;
      this.ee.emit('audiorequeststatechange', this.audioRequestState, this.src);
    }
  }, {
    key: 'fileProgress',
    value: function fileProgress(e) {
      var percentComplete = 0;

      if (this.audioRequestState === STATE_UNINITIALIZED) {
        this.setStateChange(STATE_LOADING);
      }

      if (e.lengthComputable) {
        percentComplete = e.loaded / e.total * 100;
      }

      this.ee.emit('loadprogress', percentComplete, this.src);
    }
  }, {
    key: 'fileLoad',
    value: function fileLoad(e) {
      var _this = this;

      var audioData = e.target.response || e.target.result;

      this.setStateChange(STATE_DECODING);

      return new Promise(function (resolve, reject) {
        _this.ac.decodeAudioData(audioData, function (audioBuffer) {
          _this.audioBuffer = audioBuffer;
          _this.setStateChange(STATE_FINISHED);

          resolve(audioBuffer);
        }, function (err) {
          reject(err);
        });
      });
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"event-emitter":23}],84:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _BlobLoader = require('./BlobLoader');

var _BlobLoader2 = _interopRequireDefault(_BlobLoader);

var _XHRLoader = require('./XHRLoader');

var _XHRLoader2 = _interopRequireDefault(_XHRLoader);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);
  }

  _createClass(_class, null, [{
    key: 'createLoader',
    value: function createLoader(src, audioContext, ee) {
      if (src instanceof Blob) {
        return new _BlobLoader2.default(src, audioContext, ee);
      } else if (typeof src === 'string') {
        return new _XHRLoader2.default(src, audioContext, ee);
      }

      throw new Error('Unsupported src type');
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"./BlobLoader":82,"./XHRLoader":85}],85:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _Loader2 = require('./Loader');

var _Loader3 = _interopRequireDefault(_Loader2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _class = function (_Loader) {
  _inherits(_class, _Loader);

  function _class() {
    _classCallCheck(this, _class);

    return _possibleConstructorReturn(this, (_class.__proto__ || Object.getPrototypeOf(_class)).apply(this, arguments));
  }

  _createClass(_class, [{
    key: 'load',


    /**
     * Loads an audio file via XHR.
     */
    value: function load() {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();

        xhr.open('GET', _this2.src, true);
        xhr.responseType = 'arraybuffer';
        xhr.send();

        xhr.addEventListener('progress', function (e) {
          _get(_class.prototype.__proto__ || Object.getPrototypeOf(_class.prototype), 'fileProgress', _this2).call(_this2, e);
        });

        xhr.addEventListener('load', function (e) {
          var decoderPromise = _get(_class.prototype.__proto__ || Object.getPrototypeOf(_class.prototype), 'fileLoad', _this2).call(_this2, e);

          decoderPromise.then(function (audioBuffer) {
            resolve(audioBuffer);
          });
        });

        xhr.addEventListener('error', function () {
          reject(Error('Track ' + _this2.src + ' failed to load'));
        });
      });
    }
  }]);

  return _class;
}(_Loader3.default);

exports.default = _class;
},{"./Loader":83}],86:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _CursorState = require('./states/CursorState');

var _CursorState2 = _interopRequireDefault(_CursorState);

var _SelectState = require('./states/SelectState');

var _SelectState2 = _interopRequireDefault(_SelectState);

var _ShiftState = require('./states/ShiftState');

var _ShiftState2 = _interopRequireDefault(_ShiftState);

var _FadeInState = require('./states/FadeInState');

var _FadeInState2 = _interopRequireDefault(_FadeInState);

var _FadeOutState = require('./states/FadeOutState');

var _FadeOutState2 = _interopRequireDefault(_FadeOutState);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {
  cursor: _CursorState2.default,
  select: _SelectState2.default,
  shift: _ShiftState2.default,
  fadein: _FadeInState2.default,
  fadeout: _FadeOutState2.default
};
},{"./states/CursorState":87,"./states/FadeInState":88,"./states/FadeOutState":89,"./states/SelectState":90,"./states/ShiftState":91}],87:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _conversions = require('../../utils/conversions');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class(track) {
    _classCallCheck(this, _class);

    this.track = track;
  }

  _createClass(_class, [{
    key: 'setup',
    value: function setup(samplesPerPixel, sampleRate) {
      this.samplesPerPixel = samplesPerPixel;
      this.sampleRate = sampleRate;
    }
  }, {
    key: 'click',
    value: function click(e) {
      e.preventDefault();

      var startX = e.offsetX;
      var startTime = (0, _conversions.pixelsToSeconds)(startX, this.samplesPerPixel, this.sampleRate);

      this.track.ee.emit('select', startTime, startTime, this.track);
    }
  }], [{
    key: 'getClass',
    value: function getClass() {
      return '.state-cursor';
    }
  }, {
    key: 'getEvents',
    value: function getEvents() {
      return ['click'];
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"../../utils/conversions":92}],88:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _conversions = require('../../utils/conversions');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class(track) {
    _classCallCheck(this, _class);

    this.track = track;
  }

  _createClass(_class, [{
    key: 'setup',
    value: function setup(samplesPerPixel, sampleRate) {
      this.samplesPerPixel = samplesPerPixel;
      this.sampleRate = sampleRate;
    }
  }, {
    key: 'click',
    value: function click(e) {
      var startX = e.offsetX;
      var time = (0, _conversions.pixelsToSeconds)(startX, this.samplesPerPixel, this.sampleRate);

      if (time > this.track.getStartTime() && time < this.track.getEndTime()) {
        this.track.ee.emit('fadein', time - this.track.getStartTime(), this.track);
      }
    }
  }], [{
    key: 'getClass',
    value: function getClass() {
      return '.state-fadein';
    }
  }, {
    key: 'getEvents',
    value: function getEvents() {
      return ['click'];
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"../../utils/conversions":92}],89:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _conversions = require('../../utils/conversions');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class(track) {
    _classCallCheck(this, _class);

    this.track = track;
  }

  _createClass(_class, [{
    key: 'setup',
    value: function setup(samplesPerPixel, sampleRate) {
      this.samplesPerPixel = samplesPerPixel;
      this.sampleRate = sampleRate;
    }
  }, {
    key: 'click',
    value: function click(e) {
      var startX = e.offsetX;
      var time = (0, _conversions.pixelsToSeconds)(startX, this.samplesPerPixel, this.sampleRate);

      if (time > this.track.getStartTime() && time < this.track.getEndTime()) {
        this.track.ee.emit('fadeout', this.track.getEndTime() - time, this.track);
      }
    }
  }], [{
    key: 'getClass',
    value: function getClass() {
      return '.state-fadeout';
    }
  }, {
    key: 'getEvents',
    value: function getEvents() {
      return ['click'];
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"../../utils/conversions":92}],90:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _conversions = require('../../utils/conversions');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class(track) {
    _classCallCheck(this, _class);

    this.track = track;
    this.active = false;
  }

  _createClass(_class, [{
    key: 'setup',
    value: function setup(samplesPerPixel, sampleRate) {
      this.samplesPerPixel = samplesPerPixel;
      this.sampleRate = sampleRate;
    }
  }, {
    key: 'emitSelection',
    value: function emitSelection(x) {
      var minX = Math.min(x, this.startX);
      var maxX = Math.max(x, this.startX);
      var startTime = (0, _conversions.pixelsToSeconds)(minX, this.samplesPerPixel, this.sampleRate);
      var endTime = (0, _conversions.pixelsToSeconds)(maxX, this.samplesPerPixel, this.sampleRate);

      this.track.ee.emit('select', startTime, endTime, this.track);
    }
  }, {
    key: 'complete',
    value: function complete(x) {
      this.emitSelection(x);
      this.active = false;
    }
  }, {
    key: 'mousedown',
    value: function mousedown(e) {
      e.preventDefault();
      this.active = true;

      this.startX = e.offsetX;
      var startTime = (0, _conversions.pixelsToSeconds)(this.startX, this.samplesPerPixel, this.sampleRate);

      this.track.ee.emit('select', startTime, startTime, this.track);
    }
  }, {
    key: 'mousemove',
    value: function mousemove(e) {
      if (this.active) {
        e.preventDefault();
        this.emitSelection(e.offsetX);
      }
    }
  }, {
    key: 'mouseup',
    value: function mouseup(e) {
      if (this.active) {
        e.preventDefault();
        this.complete(e.offsetX);
      }
    }
  }, {
    key: 'mouseleave',
    value: function mouseleave(e) {
      if (this.active) {
        e.preventDefault();
        this.complete(e.offsetX);
      }
    }
  }], [{
    key: 'getClass',
    value: function getClass() {
      return '.state-select';
    }
  }, {
    key: 'getEvents',
    value: function getEvents() {
      return ['mousedown', 'mousemove', 'mouseup', 'mouseleave'];
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"../../utils/conversions":92}],91:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _conversions = require('../../utils/conversions');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class(track) {
    _classCallCheck(this, _class);

    this.track = track;
    this.active = false;
  }

  _createClass(_class, [{
    key: 'setup',
    value: function setup(samplesPerPixel, sampleRate) {
      this.samplesPerPixel = samplesPerPixel;
      this.sampleRate = sampleRate;
    }
  }, {
    key: 'emitShift',
    value: function emitShift(x) {
      var deltaX = x - this.prevX;
      var deltaTime = (0, _conversions.pixelsToSeconds)(deltaX, this.samplesPerPixel, this.sampleRate);
      this.prevX = x;
      this.track.ee.emit('shift', deltaTime, this.track);
    }
  }, {
    key: 'complete',
    value: function complete(x) {
      this.emitShift(x);
      this.active = false;
    }
  }, {
    key: 'mousedown',
    value: function mousedown(e) {
      e.preventDefault();

      this.active = true;
      this.el = e.target;
      this.prevX = e.offsetX;
    }
  }, {
    key: 'mousemove',
    value: function mousemove(e) {
      if (this.active) {
        e.preventDefault();
        this.emitShift(e.offsetX);
      }
    }
  }, {
    key: 'mouseup',
    value: function mouseup(e) {
      if (this.active) {
        e.preventDefault();
        this.complete(e.offsetX);
      }
    }
  }, {
    key: 'mouseleave',
    value: function mouseleave(e) {
      if (this.active) {
        e.preventDefault();
        this.complete(e.offsetX);
      }
    }
  }], [{
    key: 'getClass',
    value: function getClass() {
      return '.state-shift';
    }
  }, {
    key: 'getEvents',
    value: function getEvents() {
      return ['mousedown', 'mousemove', 'mouseup', 'mouseleave'];
    }
  }]);

  return _class;
}();

exports.default = _class;
},{"../../utils/conversions":92}],92:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.samplesToSeconds = samplesToSeconds;
exports.secondsToSamples = secondsToSamples;
exports.samplesToPixels = samplesToPixels;
exports.pixelsToSamples = pixelsToSamples;
exports.pixelsToSeconds = pixelsToSeconds;
exports.secondsToPixels = secondsToPixels;
function samplesToSeconds(samples, sampleRate) {
  return samples / sampleRate;
}

function secondsToSamples(seconds, sampleRate) {
  return Math.ceil(seconds * sampleRate);
}

function samplesToPixels(samples, resolution) {
  return Math.floor(samples / resolution);
}

function pixelsToSamples(pixels, resolution) {
  return Math.floor(pixels * resolution);
}

function pixelsToSeconds(pixels, resolution, sampleRate) {
  return pixels * resolution / sampleRate;
}

function secondsToPixels(seconds, resolution, sampleRate) {
  return Math.ceil(seconds * sampleRate / resolution);
}
},{}],93:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function () {
  var recLength = 0;
  var recBuffersL = [];
  var recBuffersR = [];
  var sampleRate = void 0;

  function init(config) {
    sampleRate = config.sampleRate;
  }

  function record(inputBuffer) {
    recBuffersL.push(inputBuffer[0]);
    recBuffersR.push(inputBuffer[1]);
    recLength += inputBuffer[0].length;
  }

  function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i += 1) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function floatTo16BitPCM(output, offset, input) {
    var writeOffset = offset;
    for (var i = 0; i < input.length; i += 1, writeOffset += 2) {
      var s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(writeOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  function encodeWAV(samples) {
    var mono = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    var buffer = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 32 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, mono ? 1 : 2, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 4, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 4, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return view;
  }

  function mergeBuffers(recBuffers, length) {
    var result = new Float32Array(length);
    var offset = 0;

    for (var i = 0; i < recBuffers.length; i += 1) {
      result.set(recBuffers[i], offset);
      offset += recBuffers[i].length;
    }
    return result;
  }

  function interleave(inputL, inputR) {
    var length = inputL.length + inputR.length;
    var result = new Float32Array(length);

    var index = 0;
    var inputIndex = 0;

    while (index < length) {
      result[index += 1] = inputL[inputIndex];
      result[index += 1] = inputR[inputIndex];
      inputIndex += 1;
    }

    return result;
  }

  function exportWAV(type) {
    var bufferL = mergeBuffers(recBuffersL, recLength);
    var bufferR = mergeBuffers(recBuffersR, recLength);
    var interleaved = interleave(bufferL, bufferR);
    var dataview = encodeWAV(interleaved);
    var audioBlob = new Blob([dataview], { type: type });

    postMessage(audioBlob);
  }

  function clear() {
    recLength = 0;
    recBuffersL = [];
    recBuffersR = [];
  }

  onmessage = function onmessage(e) {
    switch (e.data.command) {
      case 'init':
        {
          init(e.data.config);
          break;
        }
      case 'record':
        {
          record(e.data.buffer);
          break;
        }
      case 'exportWAV':
        {
          exportWAV(e.data.type);
          break;
        }
      case 'clear':
        {
          clear();
          break;
        }
      default:
        {
          throw new Error('Unknown export worker command');
        }
    }
  };
};
},{}],94:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function () {
  // http://jsperf.com/typed-array-min-max/2
  // plain for loop for finding min/max is way faster than anything else.
  /**
  * @param {TypedArray} array - Subarray of audio to calculate peaks from.
  */
  function findMinMax(array) {
    var min = Infinity;
    var max = -Infinity;
    var curr = void 0;

    for (var i = 0; i < array.length; i += 1) {
      curr = array[i];
      if (min > curr) {
        min = curr;
      }
      if (max < curr) {
        max = curr;
      }
    }

    return {
      min: min,
      max: max
    };
  }

  /**
  * @param {Number} n - peak to convert from float to Int8, Int16 etc.
  * @param {Number} bits - convert to #bits two's complement signed integer
  */
  function convert(n, bits) {
    var max = Math.pow(2, bits - 1);
    var v = n < 0 ? n * max : n * max - 1;
    return Math.max(-max, Math.min(max - 1, v));
  }

  /**
  * @param {TypedArray} channel - Audio track frames to calculate peaks from.
  * @param {Number} samplesPerPixel - Audio frames per peak
  */
  function extractPeaks(channel, samplesPerPixel, bits) {
    var chanLength = channel.length;
    var numPeaks = Math.ceil(chanLength / samplesPerPixel);
    var start = void 0;
    var end = void 0;
    var segment = void 0;
    var max = void 0;
    var min = void 0;
    var extrema = void 0;

    // create interleaved array of min,max
    var peaks = new self['Int' + bits + 'Array'](numPeaks * 2);

    for (var i = 0; i < numPeaks; i += 1) {
      start = i * samplesPerPixel;
      end = (i + 1) * samplesPerPixel > chanLength ? chanLength : (i + 1) * samplesPerPixel;

      segment = channel.subarray(start, end);
      extrema = findMinMax(segment);
      min = convert(extrema.min, bits);
      max = convert(extrema.max, bits);

      peaks[i * 2] = min;
      peaks[i * 2 + 1] = max;
    }

    return peaks;
  }

  /**
  * @param {TypedArray} source - Source of audio samples for peak calculations.
  * @param {Number} samplesPerPixel - Number of audio samples per peak.
  * @param {Number} cueIn - index in channel to start peak calculations from.
  * @param {Number} cueOut - index in channel to end peak calculations from (non-inclusive).
  */
  function audioPeaks(source) {
    var samplesPerPixel = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 10000;
    var bits = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 8;

    if ([8, 16, 32].indexOf(bits) < 0) {
      throw new Error('Invalid number of bits specified for peaks.');
    }

    var peaks = [];
    var start = 0;
    var end = source.length;
    peaks.push(extractPeaks(source.subarray(start, end), samplesPerPixel, bits));

    var length = peaks[0].length / 2;

    return {
      bits: bits,
      length: length,
      data: peaks
    };
  }

  onmessage = function onmessage(e) {
    var peaks = audioPeaks(e.data.samples, e.data.samplesPerPixel);

    postMessage(peaks);
  };
};
},{}],95:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (format) {
  function clockFormat(seconds, decimals) {
    var hours = parseInt(seconds / 3600, 10) % 24;
    var minutes = parseInt(seconds / 60, 10) % 60;
    var secs = (seconds % 60).toFixed(decimals);

    var sHours = hours < 10 ? '0' + hours : hours;
    var sMinutes = minutes < 10 ? '0' + minutes : minutes;
    var sSeconds = secs < 10 ? '0' + secs : secs;

    return sHours + ':' + sMinutes + ':' + sSeconds;
  }

  var formats = {
    seconds: function seconds(_seconds) {
      return _seconds.toFixed(0);
    },
    thousandths: function thousandths(seconds) {
      return seconds.toFixed(3);
    },

    'hh:mm:ss': function hhmmss(seconds) {
      return clockFormat(seconds, 0);
    },
    'hh:mm:ss.u': function hhmmssu(seconds) {
      return clockFormat(seconds, 1);
    },
    'hh:mm:ss.uu': function hhmmssuu(seconds) {
      return clockFormat(seconds, 2);
    },
    'hh:mm:ss.uuu': function hhmmssuuu(seconds) {
      return clockFormat(seconds, 3);
    }
  };

  return formats[format];
};
},{}],96:[function(require,module,exports){
(function (global){

var rng;

var crypto = global.crypto || global.msCrypto; // for IE 11
if (crypto && crypto.getRandomValues) {
  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
  // Moderately fast, high quality
  var _rnds8 = new Uint8Array(16);
  rng = function whatwgRNG() {
    crypto.getRandomValues(_rnds8);
    return _rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var  _rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return _rnds;
  };
}

module.exports = rng;


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],97:[function(require,module,exports){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

// Unique ID creation requires a high quality random # generator.  We feature
// detect to determine the best RNG source, normalizing to a function that
// returns 128-bits of randomness, since that's what's usually required
var _rng = require('./rng');

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
  _byteToHex[i] = (i + 0x100).toString(16).substr(1);
  _hexToByte[_byteToHex[i]] = i;
}

// **`parse()` - Parse a UUID into it's component bytes**
function parse(s, buf, offset) {
  var i = (buf && offset) || 0, ii = 0;

  buf = buf || [];
  s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
    if (ii < 16) { // Don't overflow!
      buf[i + ii++] = _hexToByte[oct];
    }
  });

  // Zero out remaining bytes if string was short
  while (ii < 16) {
    buf[i + ii++] = 0;
  }

  return buf;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
  var i = offset || 0, bth = _byteToHex;
  return  bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

// random #'s we need to init node and clockseq
var _seedBytes = _rng();

// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
var _nodeId = [
  _seedBytes[0] | 0x01,
  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
];

// Per 4.2.2, randomize (14 bit) clockseq
var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

// Previous uuid creation time
var _lastMSecs = 0, _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};

  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  var node = options.node || _nodeId;
  for (var n = 0; n < 6; n++) {
    b[i + n] = node[n];
  }

  return buf ? buf : unparse(b);
}

// **`v4()` - Generate random UUID**

// See https://github.com/broofa/node-uuid for API details
function v4(options, buf, offset) {
  // Deprecated - 'format' argument, as supported in v1.2
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || _rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ii++) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || unparse(rnds);
}

// Export public API
var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;
uuid.parse = parse;
uuid.unparse = unparse;

module.exports = uuid;

},{"./rng":96}],98:[function(require,module,exports){
'use strict';

//http://jsperf.com/typed-array-min-max/2
//plain for loop for finding min/max is way faster than anything else.
/**
* @param {TypedArray} array - Subarray of audio to calculate peaks from.
*/
function findMinMax(array) {
    var min = Infinity;
    var max = -Infinity;
    var i = 0;
    var len = array.length;
    var curr;

    for(; i < len; i++) {
        curr = array[i];
        if (min > curr) {
            min = curr;
        }
        if (max < curr) {
            max = curr;
        }
    }

    return {
        min: min,
        max: max
    };
}

/**
* @param {Number} n - peak to convert from float to Int8, Int16 etc.
* @param {Number} bits - convert to #bits two's complement signed integer
*/
function convert(n, bits) {
    var max = Math.pow(2, bits-1);
    var v = n < 0 ? n * max : n * max - 1;
    return Math.max(-max, Math.min(max-1, v));
}

/**
* @param {TypedArray} channel - Audio track frames to calculate peaks from.
* @param {Number} samplesPerPixel - Audio frames per peak
*/
function extractPeaks(channel, samplesPerPixel, bits) {
    var i;
    var chanLength = channel.length;
    var numPeaks = Math.ceil(chanLength / samplesPerPixel);
    var start;
    var end;
    var segment;
    var max; 
    var min;
    var extrema;

    //create interleaved array of min,max
    var peaks = new (eval("Int"+bits+"Array"))(numPeaks*2);

    for (i = 0; i < numPeaks; i++) {

        start = i * samplesPerPixel;
        end = (i + 1) * samplesPerPixel > chanLength ? chanLength : (i + 1) * samplesPerPixel;

        segment = channel.subarray(start, end);
        extrema = findMinMax(segment);
        min = convert(extrema.min, bits);
        max = convert(extrema.max, bits);

        peaks[i*2] = min;
        peaks[i*2+1] = max;
    }

    return peaks;
}

function makeMono(channelPeaks, bits) {
    var numChan = channelPeaks.length;
    var weight = 1 / numChan;
    var numPeaks = channelPeaks[0].length / 2;
    var c = 0;
    var i = 0;
    var min;
    var max;
    var peaks = new (eval("Int"+bits+"Array"))(numPeaks*2);

    for (i = 0; i < numPeaks; i++) {
        min = 0;
        max = 0;

        for (c = 0; c < numChan; c++) {
            min += weight * channelPeaks[c][i*2];
            max += weight * channelPeaks[c][i*2+1];
        }

        peaks[i*2] = min;
        peaks[i*2+1] = max;
    }

    //return in array so channel number counts still work.
    return [peaks];
}

/**
* @param {AudioBuffer,TypedArray} source - Source of audio samples for peak calculations.
* @param {Number} samplesPerPixel - Number of audio samples per peak.
* @param {Number} cueIn - index in channel to start peak calculations from.
* @param {Number} cueOut - index in channel to end peak calculations from (non-inclusive).
*/
module.exports = function(source, samplesPerPixel, isMono, cueIn, cueOut, bits) {
    samplesPerPixel = samplesPerPixel || 10000;
    bits = bits || 8;
    
    if (isMono === null || isMono === undefined) {
        isMono = true;
    }

    if ([8, 16, 32].indexOf(bits) < 0) {
        throw new Error("Invalid number of bits specified for peaks.");
    }

    var numChan = source.numberOfChannels;
    var peaks = [];
    var c;
    var numPeaks;
    var channel;
    var slice;

    if (typeof source.subarray === "undefined") {
        for (c = 0; c < numChan; c++) {
            channel = source.getChannelData(c);
            cueIn = cueIn || 0;
            cueOut = cueOut || channel.length;
            slice = channel.subarray(cueIn, cueOut);
            peaks.push(extractPeaks(slice, samplesPerPixel, bits));
        }
    }
    else {
        cueIn = cueIn || 0;
        cueOut = cueOut || source.length;
        peaks.push(extractPeaks(source.subarray(cueIn, cueOut), samplesPerPixel, bits));
    }

    if (isMono && peaks.length > 1) {
        peaks = makeMono(peaks, bits);
    }

    numPeaks = peaks[0].length / 2;

    return {
        length: numPeaks,
        data: peaks,
        bits: bits
    };
};
},{}],99:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}]},{},[1]);
