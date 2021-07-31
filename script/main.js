// display vars
var realW = window.innerWidth
var realH = window.innerHeight - 3
let mic, recorder,fft

//color corrector vars
let shouldUpdateMaxs  = true// in second
let maxUpdateDelay = 15 * 1000
let colorShift = 0;
let colorShiftFreq = 1 * 1000
let colorShiftDir = 1

let cutoff = [0.1,0.5]

let maxs = [0,0,0]

function setup() {
    let cnv = createCanvas(realW, realH);
    cnv.mousePressed(userStartAudio);
    mic = new p5.AudioIn();

    fft = new p5.FFT();
    mic.start();

    // create a sound recorder
    recorder = new p5.SoundRecorder();

    userStartAudio(this, () => {
        // connect the mic to the recorder
        recorder.setInput(mic);

        fft.setInput(mic);
    });

    setTimeout(()=>{
        shouldUpdateMaxs = false
    },maxUpdateDelay)
    
    setInterval(shiftColor,colorShiftFreq)
}

function draw() {
    clear()
   // debugSpectrum()
    updateAllMaxs()

    let soundVec = []

    soundVec[0] = getLow() / maxs[0]
    soundVec[1] = getMid() / maxs[1]
    soundVec[2] = getHigh() / maxs[2]

    colorVec = soundVec.map((x,i) => getShiftedColor( x  * 255,i))

    background(colorVec)
    text(maxs,100,100)
    text(soundVec,100,200)
    text(shouldUpdateMaxs,100,350)
    text(colorShift,100,300)
}

function updateAllMaxs(){
    if (!shouldUpdateMaxs) return;

    updateLastMaxLow()
    updateLastMaxMid()
    updateLastMaxHigh()

}

function updateLastMaxLow(){
    let lowLevel = getLow()
    
    if (maxs[0] < lowLevel) {
        maxs[0] = lowLevel
    }
}

function updateLastMaxMid() {
    let micMid = getMid();

    if (maxs[1] < micMid) {
        maxs[1] = micMid
    }
}

function updateLastMaxHigh(){
    let highLevel = getHigh()
    
    if (maxs[2] < highLevel) {
        maxs[2] = highLevel
    }
}

function getHigh(){
    return  getAccSpectrum(cutoff[1],1)
}

function getLow(){
    return getAccSpectrum(0,cutoff[0])
}

function getMid() {
    return getAccSpectrum(cutoff[0],cutoff[1])
}

function getSpectrum() {
    return fft.analyze();
}

function shiftColor(){

    if(colorShift > 254)
        colorShiftDir = -colorShiftDir
    
    colorShift += colorShiftDir
}

function getShiftedColor(color,i){
    let newColor = color + colorShift 

    if(newColor > 255){
        newColor = 255 - ( newColor - 255 )
    }

    return newColor
}


function debugSpectrum() {
    spectrum = getSpectrum()

    push()
    beginShape();
    for (i = 0; i < spectrum.length; i++) {
      vertex(map(i,0,spectrum.length,0,width), map(spectrum[i], 0, 255, height, 0));
    }
    endShape();
    pop()
}

function getAccSpectrum(uv_start,uv_end){
    let spec = getSpectrum()
    let startIndex = Math.floor(spec.length * uv_start)
    let endIndex = Math.floor(spec.length * uv_end)

    return spec.slice(startIndex,endIndex).reduce((a,b)=>{return a + b},0)
}

