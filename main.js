document.addEventListener("DOMContentLoaded", function(event) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let currentWave = 'sine';
    let synthMode = "Additive";
    const synthModes = ["Additive","AM","FM"];
    let attackTime = 0.5;
    const decayTime = 0.2;
    const sustainVal = 0.3;
    let releaseTime = 1.5;
    const modRatio = 2;
    let indexAmount = 30;
    let lfoFreqVal = 2;
    let numPartials = 2;

    const smileyList = [":)", ":D", "C:", ":/", "/:", ";)", ":P", "XD", ":-O", "B)", "<3"];
    const smileyDiv = document.getElementById('smiley');
    
    const globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);

    const waveSelect = document.getElementById('wave-select');
    waveSelect.addEventListener('change', () => {
        currentWave = waveSelect.value;
    });

    const attackSlider = document.getElementById('attack-slider');
    attackSlider.addEventListener('input', () => {
        attackTime = parseFloat(attackSlider.value);
    });

    const releaseSlider = document.getElementById('release-slider');
    releaseSlider.addEventListener('input', () => {
        releaseTime = parseFloat(releaseSlider.value);
    });

    let synthModeIndex = 0;

    const modeToggleBtn = document.getElementById('modeToggle');
    modeToggleBtn.addEventListener('click', () => {
        synthModeIndex = (synthModeIndex + 1) % synthModes.length;
        synthMode = synthModes[synthModeIndex];
        modeToggleBtn.textContent = `Mode: ${synthMode}`;
    });

    const lfoSlider = document.getElementById('lfo-slider');
    lfoSlider.addEventListener('input', () => {

        updateFreq(lfoSlider.value);
    });
    function updateFreq(val) {
        lfoFreqVal = val;

        Object.keys(activeOscillators).forEach(key => {            const data = activeOscillators[key];
            const gainNode = data[1];
            const oscillators = data[0];
            const lfos = data[2];
            if (lfos.length > 0) {
                lfos[0].frequency.value = val;
            }

        })
    };

    const partialsSlider = document.getElementById('partials-slider');
    partialsSlider.addEventListener('input', () => {
        numPartials = parseInt(partialsSlider.value);
    });

    const indexSlider = document.getElementById('index-slider');
    indexSlider.addEventListener('input', () => {
        indexAmount = parseFloat(indexSlider.value);
        Object.keys(activeOscillators).forEach(key => {            const data = activeOscillators[key];
            
            const mods = data[3];
            if (mods.length > 0) {
                mods[0].gain.value = keyboardFrequencyMap[key]*modRatio*indexAmount
            }

        })
    });

    const keyboardFrequencyMap = {
        '90': 261.625565300598634,  //Z - C
        '83': 277.182630976872096, //S - C#
        '88': 293.664767917407560,  //X - D
        '68': 311.126983722080910, //D - D#
        '67': 329.627556912869929,  //C - E
        '86': 349.228231433003884,  //V - F
        '71': 369.994422711634398, //G - F#
        '66': 391.995435981749294,  //B - G
        '72': 415.304697579945138, //H - G#
        '78': 440.000000000000000,  //N - A
        '74': 466.163761518089916, //J - A#
        '77': 493.883301256124111,  //M - B
        '81': 523.251130601197269,  //Q - C
        '50': 554.365261953744192, //2 - C#
        '87': 587.329535834815120,  //W - D
        '51': 622.253967444161821, //3 - D#
        '69': 659.255113825739859,  //E - E
        '82': 698.456462866007768,  //R - F
        '53': 739.988845423268797, //5 - F#
        '84': 783.990871963498588,  //T - G
        '54': 830.609395159890277, //6 - G#
        '89': 880.000000000000000,  //Y - A
        '55': 932.327523036179832, //7 - A#
        '85': 987.766602512248223,  //U - B
    }

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    let activeOscillators = {};

    function updateSmiley() {
        const randomSmiley = smileyList[Math.floor(Math.random() * smileyList.length)];
        smileyDiv.textContent = randomSmiley;
    }

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            playNote(key);
            updateSmiley();
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            const now = audioCtx.currentTime;
            const data = activeOscillators[key];
            const gainNode = data[1];
            const oscillators = data[0];
            
            // Start release envelope
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
            
            oscillators.forEach(osc => {
                osc.stop(now + releaseTime);
                setTimeout(() => {
                    osc.disconnect();
                }, releaseTime * 1000 + 50);
            })
            
            delete activeOscillators[key];

            setTimeout(() => {
                gainNode.disconnect();
            }, releaseTime * 1000 + 50);
        }
    }

    function playNote(key) {
        const now = audioCtx.currentTime;

        const numVoices = Object.keys(activeOscillators).length + 1;
        const peakGain = 0.6 / Math.sqrt(numVoices);
        const sustainGain = peakGain * sustainVal;

        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + attackTime);
        gainNode.gain.linearRampToValueAtTime(sustainGain, now + attackTime + decayTime);
        gainNode.connect(globalGain);

        let oscillators = [];
        let lfos = [];
        let FMmodulators = [];
        if (synthMode === "Additive") {
            const allPartials = [
                {ratio:1, amp:0.6},
                {ratio:1.25, amp:0.3},
                {ratio:1.5, amp:0.2}, // triad
                {ratio:2, amp:0.1},
                {ratio:3, amp:0.05}
            ];
            const partials = allPartials.slice(0, numPartials);
            
            partials.forEach(partial => {
                const osc = audioCtx.createOscillator();
                osc.frequency.setValueAtTime(keyboardFrequencyMap[key] * partial.ratio, now);
                osc.type = currentWave;
                const partialGain = audioCtx.createGain();
                partialGain.gain.setValueAtTime(0, now);
                partialGain.gain.linearRampToValueAtTime(partial.amp, now + attackTime);
                partialGain.gain.linearRampToValueAtTime(sustainGain, now + attackTime + decayTime);

                osc.connect(partialGain);
                partialGain.connect(gainNode);
                osc.start(now);
                oscillators.push(osc);
            })
            
        } else if (synthMode === "AM") {
            var carrier = audioCtx.createOscillator();
            var modulatorFreq = audioCtx.createOscillator();
            modulatorFreq.frequency.value = 100;

            const useLowCarrier = document.getElementById('carrier-toggle').checked;
            carrier.frequency.setValueAtTime(useLowCarrier ? 1 : keyboardFrequencyMap[key], now);
            carrier.type = currentWave;
        
            const modulated = audioCtx.createGain();
            const depth = audioCtx.createGain();
            depth.gain.value = 0.5 //scale modulator output to [-0.5, 0.5]
            modulated.gain.value = 1.0 - depth.gain.value; //a fixed value of 0.5
        
            modulatorFreq.connect(depth).connect(modulated.gain); //.connect is additive, so with [-0.5,0.5] and 0.5, the modulated signal now has output gain at [0,1]
            carrier.connect(modulated)
            modulated.connect(gainNode);
            
            var lfo = audioCtx.createOscillator();
            lfo.frequency.value = lfoFreqVal;
            var lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 100;
            lfo.connect(lfoGain).connect(modulatorFreq.frequency);
            lfo.start();


            carrier.start();
            modulatorFreq.start();
            oscillators.push(carrier);
            oscillators.push(modulatorFreq);
            oscillators.push(lfo);
            lfos.push(lfo);
        } else if (synthMode === "FM") {
            var carrier = audioCtx.createOscillator();
            var modulatorFreq = audioCtx.createOscillator();
            const freq = keyboardFrequencyMap[key];
            

            carrier.frequency.setValueAtTime(freq, now);
            modulatorFreq.frequency.setValueAtTime(freq * modRatio, now);

            var modulationIndex = audioCtx.createGain();
            modulationIndex.gain.value = freq*modRatio*indexAmount;

            modulatorFreq.connect(modulationIndex);
            modulationIndex.connect(carrier.frequency)
            
            carrier.connect(gainNode);
            
            
            carrier.start();
            modulatorFreq.start();
            oscillators.push(carrier);
            oscillators.push(modulatorFreq)
            FMmodulators.push(modulationIndex);

        }


        activeOscillators[key] = [oscillators, gainNode, lfos, FMmodulators];
        
        
    }
});