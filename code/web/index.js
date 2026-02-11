import init, * as wasm from "./wasm.js"

const WIDTH = 64
const HEIGHT = 32
const SCALE = 15
const TICKS_PER_FRAME = 10
let anim_frame = 0

const canvas = document.getElementById("canvas")
canvas.width = WIDTH * SCALE
canvas.height = HEIGHT * SCALE

const ctx = canvas.getContext("2d")
ctx.fillStyle = "black"
ctx.fillRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)

const input = document.getElementById("fileinput")

// ===== SOUND CLASS =====
class Chip8Sound {
    constructor() {
        this.audioContext = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.enabled = true;
    }

    init() {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = 0.1; // 10% volume
        } catch (e) {
            console.error("Failed to initialize audio:", e);
            this.enabled = false;
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.stop();
        }
    }

    play() {
        if (!this.enabled) return;
        if (!this.audioContext) this.init();
        if (!this.audioContext) return;

        if (!this.isPlaying) {
            try {
                this.oscillator = this.audioContext.createOscillator();
                this.oscillator.type = 'square';
                this.oscillator.frequency.value = 440;
                this.oscillator.connect(this.gainNode);
                this.oscillator.start();
                this.isPlaying = true;
            } catch (e) {
                console.error("Failed to play sound:", e);
            }
        }
    }

    stop() {
        if (this.isPlaying && this.oscillator) {
            try {
                this.oscillator.stop();
                this.oscillator.disconnect();
            } catch (e) {
                // Oscillator already stopped
            }
            this.oscillator = null;
            this.isPlaying = false;
        }
    }

    update(soundTimer) {
        if (soundTimer > 0 && this.enabled) {
            this.play();
        } else {
            this.stop();
        }
    }
}

// Initialize sound
const sound = new Chip8Sound()
let audioInitialized = false

// Initialize audio on first user interaction
function initAudio() {
    if (!audioInitialized) {
        sound.init()
        audioInitialized = true
    }
}

async function run() {
    try {
        await init()

        let chip8 = new wasm.EmuWasm()

        document.addEventListener("keydown", function(evt) {
            initAudio()
            chip8.keypress(evt, true)
        })

        document.addEventListener("keyup", function(evt) {
            chip8.keypress(evt, false)
        })

        // Sound toggle event listener
        const soundToggle = document.getElementById("sound-toggle")
        if (soundToggle) {
            soundToggle.addEventListener("change", (evt) => {
                sound.setEnabled(evt.target.checked)
            })
        }

        input.addEventListener("change", function(evt) {
            initAudio()

            // Stop previous game from rendering, if one exists
            if (anim_frame != 0) {
                window.cancelAnimationFrame(anim_frame)
            }

            let file = evt.target.files[0]
            if (!file) {
                alert("Failed to read file")
                return
            }

            // Load in game as Uint8Array, send to .wasm, start main loop
            let fr = new FileReader()
            fr.onload = function(e) {
                let buffer = fr.result
                const rom = new Uint8Array(buffer)
                chip8.reset()
                chip8.load_game(rom)
                mainloop(chip8)
            }
            fr.readAsArrayBuffer(file)
        }, false)
    } catch (error) {
        console.error("Error in run function:", error)
    }
}

function mainloop(chip8) {
    // Only draw every few ticks
    for (let i = 0; i < TICKS_PER_FRAME; i++) {
        chip8.tick()
    }
    chip8.tick_timers()

    // Update sound based on sound timer
    const soundTimer = chip8.get_sound_timer()
    sound.update(soundTimer)

    // Clear the canvas before drawing
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)

    // Set the draw color back to white before we render our frame
    ctx.fillStyle = "white"
    chip8.draw_screen(SCALE)

    anim_frame = window.requestAnimationFrame(() => {
        mainloop(chip8)
    })
}

run().catch(error => {
    console.error("Fatal error:", error)
})
