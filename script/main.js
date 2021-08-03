//TODO : use matric for shifting frequency elegently and not just going from sharp to pastell colors
//TODO : Control interface to adjust specter
//TODO : Button to reset the view

// display vars
var realW = window.innerWidth
var realH = window.innerHeight
let mic, recorder, fft
let isDebug = false

//color corrector vars
let isCalibrating = true// in second
let maxUpdateDelay = 15 * 1000
let colorShift = 0;


let colorShiftFreq = 1 * 100000000
let colorShiftDir = 1

let cutoff = [0.20, 0.4]
let cutOffSliders = []

let maxs = [0, 0, 0]
let mins = [Infinity, Infinity, Infinity]
let calibrationTimeout
let soundVec = [0, 0, 0]

function setupGUI() {
    cutOffSliders = [createSlider(0, 1000, cutoff[0] * 1000), createSlider(0, 1000, cutoff[1] * 1000)]
    cutOffSliders[0].position(0, realH - 100)
    cutOffSliders[0].style('width', realW + 'px')
    cutOffSliders[1].position(0, realH - 50)
    cutOffSliders[1].style('width', realW + 'px')
}

function setup() {
    let cnv = createCanvas(realW, realH);
    cnv.mousePressed(userStartAudio);
    mic = new p5.AudioIn();

    fft = new p5.FFT(0.9);
    mic.start();

    // create a sound recorder
    recorder = new p5.SoundRecorder();

    userStartAudio(this, () => {
        // connect the mic to the recorder
        recorder.setInput(mic);

        fft.setInput(mic);
    });

    resetCalibrationTimeout()

    setInterval(shiftColor, colorShiftFreq)

    setupGUI()
}

function draw() {
    if (cutoff[0] !== cutOffSliders[0].value() / 1000 || cutoff[1] !== cutOffSliders[1].value() / 1000) {
        cutoff[0] = cutOffSliders[0].value() / 1000
        cutoff[1] = cutOffSliders[1].value() / 1000
        resetMaxs()
    }

    if (isCalibrating)
        updateAllMaxs()

    soundVec = [
        getLow() / (maxs[0] - mins[0]),
        getMid() / (maxs[1] - mins[1]),
        getHigh() / (maxs[2] - mins[2])
    ]
    colorVec = soundVec.map((x, i) => getShiftedColor(x * 255, i))

    background(colorVec)
    drawDebug()
}

function drawDebug() {
    if (isDebug) {
        displayDebugSpectrum()
        displayDebugCutoff()
        displayDebugEnergy()
        displayDebugGUI()
    }

    displayBasicDebugText()
}


function keyPressed() {
    if (key === 'd') {
        isDebug = !isDebug
        if (isDebug) {
            cutOffSliders[0].style('display', 'inherit')
            cutOffSliders[1].style('display', 'inherit')
        } else {
            cutOffSliders[0].style('display', 'none')
            cutOffSliders[1].style('display', 'none')
        }
    }

    if (key === 'c') {
        resetMaxs()
    }
}

function resetCalibrationTimeout() {
    isCalibrating = true
    if (calibrationTimeout) {
        clearTimeout(calibrationTimeout)
    }
    calibrationTimeout = setTimeout(() => {
        isCalibrating = false
    }, maxUpdateDelay)
}

function resetMaxs() {
    maxs = [0, 0, 0]
    mins = [0, 0, 0]

    resetCalibrationTimeout()
}

function updateAllMaxs() {
    updateLastMaxLow()
    updateLastMaxMid()
    updateLastMaxHigh()

}

function updateLastMaxLow() {
    let lowLevel = getLow()

    if (maxs[0] < lowLevel) {
        maxs[0] = lowLevel
    }

    if (mins[0] > lowLevel) {
        mins[0] = lowLevel
    }
}

function updateLastMaxMid() {
    let micMid = getMid();

    if (maxs[1] < micMid) {
        maxs[1] = micMid
    }

    if (mins[1] > micMid) {
        mins[1] = micMid
    }
}

function updateLastMaxHigh() {
    let highLevel = getHigh()

    if (maxs[2] < highLevel) {
        maxs[2] = highLevel
    }

    if (mins[2] > highLevel) {
        mins[2] = highLevel
    }
}

function getHigh() {
    return getAccSpectrum(cutoff[1], 1) ?? 0
}

function getLow() {
    return getAccSpectrum(0, cutoff[0]) ?? 0
}

function getMid() {
    return getAccSpectrum(cutoff[0], cutoff[1]) ?? 0
}

function getSpectrum() {
    return fft.analyze();
}

function shiftColor() {

    if (colorShift > 254)
        colorShiftDir = -colorShiftDir

    colorShift += colorShiftDir
}

function getShiftedColor(color, i) {
    let newColor = color + colorShift

    if (newColor > 255) {
        newColor = 255 - (newColor - 255)
    }

    return newColor
}

function getAccSpectrum(uv_start, uv_end) {
    let spec = getSpectrum()
    let startIndex = Math.floor(spec.length * uv_start)
    let endIndex = Math.floor(spec.length * uv_end)

    return spec.slice(startIndex, endIndex).reduce((a, b) => { return a + b }, 0)
}

function displayDebugSpectrum() {
    spectrum = getSpectrum()

    push()
    fill([0, 0, 0])
    beginShape();
    vertex(0, height)
    for (i = 0; i < spectrum.length; i++) {
        vertex(map(i, 0, spectrum.length, 0, width), map(spectrum[i], 0, 255, height, 0));
    }
    vertex(width, height)
    endShape();
    pop()
}

function displayBasicDebugText() {
    push()
    stroke(0)
    fill([0, 100, 255])
    text("Press 'D' for debug GUI", 50, 10, 200)
    pop()
    text(maxs, 50, 100)
    text(soundVec, 50, 150)
    text(isCalibrating, 50, 200)
    text(colorShift, 50, 250)
}

function displayDebugCutoff() {
    push()
    stroke(255)
    line(realW * cutoff[0], 0, realW * cutoff[0], realH)
    line(realW * cutoff[1], 0, realW * cutoff[1], realH)
    pop()
}

function displayDebugEnergy() {
    push()
    noStroke()
    fill(255, 255, 255, 50)
    rect(0                  , realH * 0.5, realW * cutoff[0]                , - realH * (0.5 - (soundVec[0])))
    rect(realW * (cutoff[0]), realH * 0.5, realW * (cutoff[1] - cutoff[0])  , realH * (0.5 - (soundVec[1])))
    rect(realW * (cutoff[1]), realH * 0.5, realW * (1 - cutoff[1])          , realH * (0.5 - (soundVec[2])))
    pop()
}

function displayDebugGUI() {
    push()
    noStroke()
    fill(isCalibrating ? [0, 255, 0, 200] : [200, 100, 100, 100])
    stroke(0)
    text("Is callibrating : " + (isCalibrating ? "ON" : "OFF, press 'C' to trun on"), 50, 50)
    pop()
}

