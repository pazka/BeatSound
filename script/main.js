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

let levelInertiaLength = 10
let levelInertiaAmount = 0.9
let levelInertias = new Array(3).fill(0).map(x => new Array(levelInertiaLength).fill(0))

let soundVec = [0, 0, 0]
levels = [0,0,0]

function setupGUI() {
    cutOffSliders = [createSlider(0, 1000, cutoff[0] * 1000), createSlider(0, 1000, cutoff[1] * 1000)]
    cutOffSliders[0].position(0, realH - 100)
    cutOffSliders[1].position(0, realH - 50)

    cutOffSliders[0].style('width', realW + 'px')
    cutOffSliders[1].style('width', realW + 'px')

    cutOffSliders[0].style('display', 'none')
    cutOffSliders[1].style('display', 'none')
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

    resetMaxs()
    setInterval(shiftColor, colorShiftFreq)

    setupGUI()
}

function draw() {
    updateLevels()

    if (cutoff[0] !== cutOffSliders[0].value() / 1000 || cutoff[1] !== cutOffSliders[1].value() / 1000) {
        cutoff[0] = cutOffSliders[0].value() / 1000
        cutoff[1] = cutOffSliders[1].value() / 1000
        resetMaxs()
    }

    if (isCalibrating)
        updateAllMaxs()

    soundVec = [
        readLow() / (maxs[0] - mins[0]),
        readMid() / (maxs[1] - mins[1]),
        readHigh() / (maxs[2] - mins[2])
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
    mins = [Infinity, Infinity, Infinity]

    resetCalibrationTimeout()
}

function updateAllMaxs() {
    let accLevels = [readLow(), readMid(), readHigh()]

    accLevels.forEach((accLevel, i) => {
        if (maxs[i] < accLevel) {
            maxs[i] = accLevel
        }

        if (mins[i] > accLevel && accLevel > 0) {
            mins[i] = accLevel
        }
    })
}

function applyInertia(spec,level){
    levelInertias[spec].shift()
    levelInertias[spec].push(level)

    if(isCalibrating){
        levelInertias[spec].map(l => (mins[spec] + maxs[spec])/2)
        return level
    }

    for (let i = 1; i < levelInertias[spec].length; i++) {
        if(levelInertias[spec][i-1] == 0){
            levelInertias[spec][i-1] = levelInertias[spec][i]
        }else{
            levelInertias[spec][i-1] = (
                (levelInertias[spec][i-1]*(levelInertiaAmount)) + 
                (levelInertias[spec][i] * (1-levelInertiaAmount))
                );
        }
    }

    return levelInertias[spec][0]
}

function updateLevels(){
    levels = [readLow(),readMid(),readHigh()]
}

function getHigh(){
    return levels[2]
}
function getMid(){
    return levels[1]
}
function getLow(){
    return levels[0]
}

function readHigh() {
    return applyInertia(2,getAccSpectrum(cutoff[1], 1) ?? 0)
}
function readMid() {
    return applyInertia(1,getAccSpectrum(cutoff[0], cutoff[1]) ?? 0)
}
function readLow() {
    return applyInertia(0,getAccSpectrum(0, cutoff[0]) ?? 0)
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
    stroke(soundVec.map(l =>( 1-l) * 255))
    strokeWeight(1)
    noFill()
    
    text("Press 'D' for debug GUI", 50, 10, 200)

    noStroke()
    fill(soundVec.map(l =>( 1-l) * 255))
    text("Inertia High = " + String(Math.round(levelInertias[2][0] - levelInertias[2][levelInertias.length-1])).padEnd(6,"0"),450,150)
    text("Inertia Mid =  " + String(Math.round(levelInertias[1][0] - levelInertias[1][levelInertias.length-1])).padEnd(6,"0"),450,160)
    text("Inertia Low =  " + String(Math.round(levelInertias[0][0] - levelInertias[0][levelInertias.length-1])).padEnd(6,"0"),450,170)
    text("Sound Vector = " + soundVec.map(v => v.toFixed(4)), 50, 150)
    text("Current Accs = " + [readLow(), readMid(), readHigh()].map(v => Math.round(v)), 50, 160)
    text("Maxs = " + maxs.map(v => Math.round(v)), 50, 172)
    text("Mins = " + mins.map(v => Math.round(v)), 50, 185)

    text(colorShift, 50, 250)
    pop()
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
    rect(0, realH * 0.5, realW * cutoff[0], realH * (0.5 - (soundVec[0])))
    rect(realW * (cutoff[0]), realH * 0.5, realW * (cutoff[1] - cutoff[0]), realH * (0.5 - (soundVec[1])))
    rect(realW * (cutoff[1]), realH * 0.5, realW * (1 - cutoff[1]), realH * (0.5 - (soundVec[2])))
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

