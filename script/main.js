//TODO : use matric for shifting frequency elegently and not just going from sharp to pastell colors
//TODO : Control interface to adjust specter
//TODO : Button to reset the view

// display vars
var realW = window.innerWidth
var realH = window.innerHeight
let mic, recorder, fft
let isDebug = false
let hideAll = false

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

let channelInertiaLength = 5
let channelInertiaAmount = 0.9
let channelInertias
let smoothingAmountSlider
let smoothingLengthField


// Sound vars
let soundVec = [0, 0, 0]
levels = [0, 0, 0]
const fftBins = 1024
const SPECTYPES = {
    FULL: 0,
    OCT_CUSTOM: 1,
    OCT_FFT: 2
}
let currentSpectrumType = SPECTYPES.OCT_FFT

function setupGUI() {
    smoothingAmountSlider = createSlider(0, 1000, channelInertiaAmount * 1000)
    smoothingLengthField = createInput(channelInertiaLength, 'number')
    cutOffSliders = [createSlider(0, 1000, cutoff[0] * 1000), createSlider(0, 1000, cutoff[1] * 1000)]

    smoothingAmountSlider.position(50, 320)
    smoothingLengthField.position(50, 350)
    cutOffSliders[0].position(0, realH - 100)
    cutOffSliders[1].position(0, realH - 50)

    smoothingAmountSlider.style('width', 100 + 'px')
    smoothingLengthField.size(50)
    cutOffSliders[0].style('width', realW + 'px')
    cutOffSliders[1].style('width', realW + 'px')

    smoothingAmountSlider.style('display', 'none')
    smoothingLengthField.style('display', 'none')
    cutOffSliders[0].style('display', 'none')
    cutOffSliders[1].style('display', 'none')
}

function setup() {
    let cnv = createCanvas(realW, realH);
    textSize(16)
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

    selectSpecType()
    resetAccMaxs()
    resetChannelInertia()
    setInterval(shiftColor, colorShiftFreq)

    setupGUI()
}

function draw() {
    updateLevels()

    //refacto with event for speed
    if (!hideAll && isDebug) {
        if (cutoff[0] !== cutOffSliders[0].value() / 1000
            || cutoff[1] !== cutOffSliders[1].value() / 1000) {
            cutoff[0] = cutOffSliders[0].value() / 1000
            cutoff[1] = cutOffSliders[1].value() / 1000
            resetAccMaxs()
        }

        if (channelInertiaLength !== parseInt(smoothingLengthField.value())
            || channelInertiaAmount !== smoothingAmountSlider.value() / 1000) {
            channelInertiaLength = parseInt(smoothingLengthField.value())
            channelInertiaAmount = smoothingAmountSlider.value() / 1000
            resetChannelInertia()
        }
    }

    if (isCalibrating)
        updateAllMaxs()

    soundVec = [
        (readLow() - mins[0]) / (maxs[0] - mins[0]),
        (readMid() - mins[1]) / (maxs[1] - mins[1]),
        (readHigh() - mins[2]) / (maxs[2] - mins[2])
    ]
    colorVec = soundVec.map((x, i) => getShiftedColor(x * 255, i))

    background(colorVec)
    drawDebug()
}

function drawDebug() {
    if (hideAll) return;

    if (isDebug) {
        displayDebugSpectrum()
        displayDebugCutoff()
        displayDebugEnergy()
        displayDebugGUI()
    }

    displayBasicDebugText()
}

function displayControls() {
    controls = [...cutOffSliders, smoothingAmountSlider, smoothingLengthField]

    if (isDebug && !hideAll) {
        controls.forEach(c => c.style('display', 'inherit'))
    } else {
        controls.forEach(c => c.style('display', 'none'))
    }
}


function keyPressed() {
    if (key === 'h') {
        hideAll = !hideAll
    }

    if (key === 'd') {
        isDebug = !isDebug
    }

    if (key === 'c') {
        resetAccMaxs()
    }

    if (key === 's') {
        selectSpecType((currentSpectrumType + 1) % (Object.keys(SPECTYPES).length))
    }

    displayControls()
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

function resetAccMaxs() {
    maxs = [0, 0, 0]
    mins = [Infinity, Infinity, Infinity]

    resetCalibrationTimeout()
}

function resetChannelInertia() {
    channelInertias = new Array(3).fill(0).map(x => new Array(channelInertiaLength).fill(0))
    //resetAccMaxs()
}

function selectSpecType(specType = SPECTYPES.OCT_FFT) {
    currentSpectrumType = specType
    resetAccMaxs()
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

function applyChannelChannelInertia(spec, level) {
    channelInertias[spec].shift()
    channelInertias[spec].push(level)

    /*if (isCalibrating) {
        channelInertias[spec].map(l => (mins[spec] + maxs[spec]) / 2)
        return level
    }*/

    for (let i = 1; i < channelInertias[spec].length; i++) {

        channelInertias[spec][i - 1] = (
            (channelInertias[spec][i - 1] * (channelInertiaAmount)) +
            (channelInertias[spec][i] * (1 - channelInertiaAmount))
        );
    }

    return channelInertias[spec][0]
}

function updateLevels() {
    levels = [readLow(), readMid(), readHigh()]
}

function getHigh() {
    return levels[2]
}
function getMid() {
    return levels[1]
}
function getLow() {
    return levels[0]
}

function readHigh() {
    return applyChannelChannelInertia(2, getAccSpectrum(cutoff[1], 1) ?? 0)
}
function readMid() {
    return applyChannelChannelInertia(1, getAccSpectrum(cutoff[0], cutoff[1]) ?? 0)
}
function readLow() {
    return applyChannelChannelInertia(0, getAccSpectrum(0, cutoff[0]) ?? 0)
}

//transform a full spectrum to a spectrum that starts at the first note of scale and last at the last one
function distributeSpectrum() {

}

function getCustomOctavedContrainedSpectrum() {
    /* from http://techlib.com/reference/musical_note_frequencies.htm#:~:text=Starting%20at%20any%20note%20the,be%20positive%2C%20negative%20or%20zero.
     *  fqNxtOct = bsNote x 2^(iOct/12)
     *  becomes ->
     *  iOct = (12 * fqNxtOct) / (bsNote * logn(2))
     */
    //refacto with init for speed
    const fq2OctNb = (fq, bsNote) => Math.round(((12 * fq) / (bsNote * Math.log(2)) / 12), 0)

    raw_spectro = getRawSpectrum();

    const specStep = 19980 / fftBins
    let newSpec = []
    let specItoOctI = []
    raw_spectro.forEach((fq, i) => {
        specItoOctI[i] = fq2OctNb(20 + i * specStep, 55)
        let step = specItoOctI[i]
        newSpec[step] = newSpec[step] ? newSpec[step] + fq : fq
    })
    return newSpec
}

function getOctavedContrainedSpectrum() {
    raw_spectro = getRawSpectrum();

    return fft.logAverages(fft.getOctaveBands())
}

function getRawSpectrum() {
    return fft.analyze(fftBins);
}

function getSpectrum() {
    switch (currentSpectrumType) {
        case SPECTYPES.FULL:
            return getRawSpectrum()
        case SPECTYPES.OCT_CUSTOM:
            return getCustomOctavedContrainedSpectrum()
        case SPECTYPES.OCT_FFT:
            return getOctavedContrainedSpectrum()
    }
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
    stroke(soundVec.map(l => (1 - l) * 255))
    strokeWeight(1)
    noFill()

    text("Press 'D' for calibration tool", 50, 10, 200)
    text("Press 'H' to hide all text", 50, 30, 200)
    text("Press 'S' to switch spectral analysis ", 50, 70)

    noStroke()
    fill(soundVec.map(l => (1 - l) * 255))

    text("Current Spectrum : " + Object.keys(SPECTYPES).map((s, i) => i == currentSpectrumType ? `[>${s}<]` : s), 50, 120)

    text("Sound Vector = " + soundVec.map(v => v.toFixed(4)), 50, 150)
    text("Current Accs = " + [readLow(), readMid(), readHigh()].map(v => Math.round(v)), 50, 165)
    text("Maxs = " + maxs.map(v => Math.round(v)), 50, 185)
    text("Mins = " + mins.map(v => Math.round(v)), 50, 200)

    text(`ChannelInertia = ${channelInertiaAmount} over ${channelInertias[0].length} binFq`, 120, 360)

    
    const inertiaDebug = (i) => Math.round(channelInertias[i].reduce((acc,tot)=> Math.abs(acc) + tot,0 ))/(maxs[i]-mins[i]) * 100
    
    rect(50, 390, inertiaDebug(0) , 10)
    rect(50, 410, inertiaDebug(1) , 10)
    rect(50, 430, inertiaDebug(2) , 10)
    text("" + inertiaDebug(0), 50, 390)
    text("" + inertiaDebug(1), 50, 410)
    text("" + inertiaDebug(2), 50, 430)


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
    fill(isCalibrating ? [0, 255, 0, 200] : [200, 255, 255, 100])
    stroke(0)
    textSize(30)
    text("Is callibrating : " + (isCalibrating ? "ON" : "OFF, press 'C' to trun on"), 50, 300)
    pop()
}

