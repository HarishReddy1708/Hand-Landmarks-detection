import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
let handLandmarker = undefined;
let runningMode = "IMAGE";
let webcamRunning = false;
let enableWebcamButton;

// Create HandLandmarker instance
const createHandLandmarker = async () => {
  console.log("Loading HandLandmarker...");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });
  console.log("HandLandmarker loaded successfully!");
  demosSection.classList.remove("invisible");
};
createHandLandmarker();

// Webcam Button Logic
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable webcam stream
function enableCam(event) {
  if (!handLandmarker) {
    console.log("Wait! HandLandmarker not loaded yet.");
    return;
  }

  webcamRunning = !webcamRunning;
  enableWebcamButton.innerText = webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS";

  const constraints = {
    video: true
  };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
let results;

// Main webcam prediction loop
async function predictWebcam() {
  canvasElement.style.width = video.videoWidth + "px";
  canvasElement.style.height = video.videoHeight + "px";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
  }

  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });

      // Ring try-on for the ring finger
      addRingToRingFinger(landmarks, canvasCtx, video.videoWidth, video.videoHeight);
    }
  }
  canvasCtx.restore();

  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}

// Ring Image Overlay Logic
function addRingToRingFinger(landmarks, context, imgWidth, imgHeight) {
  const ringFingerBase = landmarks[12]; // Ring finger base
  const ringFingerMiddle = landmarks[13]; // Ring finger middle
  const ringFingerTip = landmarks[14]; // Ring finger tip

  const ringFingerLength = Math.sqrt(
    Math.pow(ringFingerTip.x - ringFingerBase.x, 2) +
    Math.pow(ringFingerTip.y - ringFingerBase.y, 2)
  );

  const ringImage = new Image();
  ringImage.src = 'assets/ring2.png'; // Path to your ring image

  ringImage.onload = () => {
    const scale = ringFingerLength * imgWidth / 150; // Scale based on finger length

    // Position of the ring based on the middle of the finger
    const ringX = (ringFingerBase.x + ringFingerMiddle.x + ringFingerTip.x) / 3 * imgWidth;
    const ringY = (ringFingerBase.y + ringFingerMiddle.y + ringFingerTip.y) / 3 * imgHeight;

    // Log positions and scaling
    console.log(`Ring X: ${ringX}, Ring Y: ${ringY}, Scale: ${scale}`);

    // Ensure that the ring stays within the canvas
    const minScale = 20;
    const adjustedScale = Math.max(minScale, scale); // Apply minimum size if needed

    // Draw the ring with calculated position and size
    context.drawImage(ringImage, ringX - adjustedScale / 2, ringY - adjustedScale / 2, adjustedScale, adjustedScale);
  };
}

