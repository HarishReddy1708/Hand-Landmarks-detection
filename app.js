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

// Ring image for try-on (ensure path is correct)
let ringImage = new Image();
ringImage.src = 'assets/ring4.png'; // Replace with your ring image URL

ringImage.onload = function () {
  console.log('Ring image loaded');
};

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
      // Draw hand landmarks and connections
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });

      // Get coordinates of the ring finger landmarks (Landmark 4 and Landmark 8)
      const ringBase = landmarks[4];  // Landmark 4 (Base of the Ring Finger)
      const ringTip = landmarks[8];   // Landmark 8 (Tip of the Ring Finger)

      // Calculate the position for the ring (just an example, you can refine it)
      const ringCenterX = (ringBase.x + ringTip.x) / 2;
      const ringCenterY = (ringBase.y + ringTip.y) / 2;

      // Draw the ring image at the center of the ring finger (adjust size as necessary)
      const ringSize = 50;  // Adjust size as needed
      canvasCtx.drawImage(ringImage, ringCenterX * canvasElement.width - ringSize / 2, ringCenterY * canvasElement.height - ringSize / 2, ringSize, ringSize);
    }
  }
  canvasCtx.restore();

  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}
