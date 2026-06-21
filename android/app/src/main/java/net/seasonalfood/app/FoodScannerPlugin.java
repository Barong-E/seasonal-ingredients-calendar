package net.seasonalfood.app;

import android.Manifest;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.util.Base64;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "FoodScanner", permissions = {
        @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera")
})
public class FoodScannerPlugin extends Plugin {
    private static final String TAG = "FoodScannerPlugin";

    // ====================================================================
    // 🔑기에 발급받으신 Gemini API 키를 입력해 주세요. (따옴표 안에 넣어주시면 됩니다!)
    // ====================================================================
    private static final String GEMINI_API_KEY = "AQ.Ab8RN6Iu-bU4wqPG0yy1FXXKwIa3rCDGUvO3aRoUSBCffRfy1A";

    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private ExecutorService cameraExecutor;
    private ViewGroup container;
    private ImageCapture imageCapture;

    @Override
    public void load() {
        super.load();
        // 백그라운드 작업을 처리할 1인용 스레드 풀 생성
        cameraExecutor = Executors.newSingleThreadExecutor();
    }

    @PluginMethod
    public void startCamera(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermCallback");
            return;
        }
        setupCamera(call);
    }

    @PermissionCallback
    private void cameraPermCallback(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            setupCamera(call);
        } else {
            call.reject("카메라 사용 권한이 거부되었습니다.");
        }
    }

    private void setupCamera(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (previewView != null) {
                    call.resolve();
                    return;
                }

                // 1. 웹뷰 배경을 투명하게 만들어 네이티브 프리뷰가 보이도록 함
                bridge.getWebView().setBackgroundColor(Color.TRANSPARENT);

                // 2. 웹뷰의 부모 레이아웃 가져오기
                container = (ViewGroup) bridge.getWebView().getParent();

                // 3. 네이티브 카메라 렌더링용 PreviewView 생성
                previewView = new PreviewView(getActivity());
                previewView.setScaleType(PreviewView.ScaleType.FIT_START);

                ViewGroup.LayoutParams params = new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT);

                // 웹뷰 레이어 아래(인덱스 0)에 삽입
                container.addView(previewView, 0, params);

                // 4. CameraX 실행 및 바인딩
                startCameraX(call);
            } catch (Exception e) {
                Log.e(TAG, "카메라 초기화 실패", e);
                call.reject("카메라 초기화 중 에러가 발생했습니다: " + e.getMessage());
            }
        });
    }

    private void startCameraX(PluginCall call) {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(getActivity());

        cameraProviderFuture.addListener(() -> {
            try {
                cameraProvider = cameraProviderFuture.get();

                // 프리뷰(뷰파인더) 설정
                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                // 사진 캡처 전용 유즈케이스 바인딩 (딜레이 최소화 모드)
                imageCapture = new ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                        .build();

                // 후면 카메라 사용
                CameraSelector cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA;

                // 기존 바인딩 전부 풀고 새로 프리뷰와 캡처 연결
                cameraProvider.unbindAll();
                cameraProvider.bindToLifecycle(
                        getActivity(),
                        cameraSelector,
                        preview,
                        imageCapture);

                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "CameraX 바인딩 실패", e);
                call.reject("카메라 바인딩 실패: " + e.getMessage());
            }
        }, ContextCompat.getMainExecutor(getActivity()));
    }

    @PluginMethod
    public void captureAndAnalyze(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("카메라 사용 권한이 없습니다.");
            return;
        }

        if (imageCapture == null) {
            call.reject("카메라가 준비되지 않았습니다.");
            return;
        }

        // 🔑 API 키 입력 여부 검사 (설정 안 하고 실행하면 친절히 안내함)
        if ("YOUR_GEMINI_API_KEY".equals(GEMINI_API_KEY) || GEMINI_API_KEY.isEmpty()) {
            call.reject("Gemini API 키가 설정되지 않았습니다. FoodScannerPlugin.java 파일 상단의 GEMINI_API_KEY 변수에 발급받으신 키를 입력해 주세요.",
                    "API_KEY_MISSING");
            return;
        }

        // 사진 촬영 시작
        imageCapture.takePicture(ContextCompat.getMainExecutor(getActivity()),
                new ImageCapture.OnImageCapturedCallback() {
                    @Override
                    public void onCaptureSuccess(@NonNull ImageProxy image) {
                        // 비디오 프레임 버퍼가 쌓이지 않도록 백그라운드 스레드에서 즉시 비동기 분석 수행
                        cameraExecutor.execute(() -> {
                            try {
                                byte[] jpegBytes = imageToByteArray(image);
                                image.close(); // 중요: 이미지 리소스를 해제해야 카메라가 막히지 않음

                                // 이미지 가로세로 최대 800px로 리사이징하여 API 전송 속도 극대화
                                byte[] optimizedBytes = resizeImage(jpegBytes, 800);

                                // 구글 Gemini 서버로 이미지와 한국어 질문 전송
                                callGeminiAPI(optimizedBytes, call);
                            } catch (Exception e) {
                                Log.e(TAG, "이미지 처리 실패", e);
                                call.reject("이미지를 가공하는 데 실패했습니다: " + e.getMessage(), "IMAGE_PROCESSING_FAILED");
                            }
                        });
                    }

                    @Override
                    public void onError(@NonNull ImageCaptureException exception) {
                        Log.e(TAG, "사진 촬영 실패", exception);
                        call.reject("사진 촬영에 실패했습니다: " + exception.getMessage(), "CAPTURE_FAILED");
                    }
                });
    }

    private byte[] imageToByteArray(ImageProxy image) {
        ByteBuffer buffer = image.getPlanes()[0].getBuffer();
        byte[] bytes = new byte[buffer.remaining()];
        buffer.get(bytes);

        // 폰 회전 각도에 맞게 원본 이미지 회전 보정
        int rotationDegrees = image.getImageInfo().getRotationDegrees();
        if (rotationDegrees != 0) {
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            Matrix matrix = new Matrix();
            matrix.postRotate(rotationDegrees);
            Bitmap rotatedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix,
                    true);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 100, out);
            bitmap.recycle();
            rotatedBitmap.recycle();
            return out.toByteArray();
        }
        return bytes;
    }

    private byte[] resizeImage(byte[] jpegBytes, int maxDimension) {
        Bitmap bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.length);
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();

        if (width <= maxDimension && height <= maxDimension) {
            return jpegBytes;
        }

        float ratio = Math.min((float) maxDimension / width, (float) maxDimension / height);
        int newWidth = Math.round(ratio * width);
        int newHeight = Math.round(ratio * height);

        Bitmap resized = Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        resized.compress(Bitmap.CompressFormat.JPEG, 85, out);
        bitmap.recycle();
        resized.recycle();
        return out.toByteArray();
    }

    private void callGeminiAPI(byte[] imageBytes, PluginCall call) {
        try {
            URL url = new URL(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="
                            + GEMINI_API_KEY);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("X-goog-api-key", GEMINI_API_KEY);
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            // 이미지 바이트를 Base64로 인코딩하여 JSON에 내장시킴
            String base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP);

            // 구글 Gemini API 명세 구조에 맞춤 JSON 빌드
            JSONObject payload = new JSONObject();
            JSONArray contents = new JSONArray();
            JSONObject contentObj = new JSONObject();
            JSONArray parts = new JSONArray();

            // 1. 프롬프트 정의
            JSONObject textPart = new JSONObject();
            textPart.put("text", "이 사진 속의 식재료가 무엇인지 한국어로 알려주세요.\n" +
                    "반드시 다음 JSON 형식으로만 응답해주세요 (백틱 ```json과 같은 마크다운 펜스는 절대 씌우지 말고 오직 순수 JSON 데이터만 반환하세요):\n" +
                    "{\n" +
                    "  \"name\": \"식재료 한국어 이름 (예: 사과, 마늘, 달래 등)\",\n" +
                    "  \"is_food\": true 또는 false (식재료가 아닌 사물이나 사람인 경우 false로 설정)\n" +
                    "}");
            parts.put(textPart);

            // 2. Base64 이미지 세팅
            JSONObject imagePart = new JSONObject();
            JSONObject inlineData = new JSONObject();
            inlineData.put("mimeType", "image/jpeg");
            inlineData.put("data", base64Image);
            imagePart.put("inlineData", inlineData);
            parts.put(imagePart);

            contentObj.put("parts", parts);
            contents.put(contentObj);
            payload.put("contents", contents);

            String jsonPayload = payload.toString();

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"));
                StringBuilder response = new StringBuilder();
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    response.append(responseLine.trim());
                }

                try {
                    // 결과 본문에서 AI 텍스트 추출
                    JSONObject responseJson = new JSONObject(response.toString());
                    JSONArray candidates = responseJson.optJSONArray("candidates");
                    if (candidates == null || candidates.length() == 0) {
                        throw new Exception("No candidates found");
                    }
                    JSONObject candidate = candidates.getJSONObject(0);
                    JSONObject content = candidate.optJSONObject("content");
                    if (content == null) {
                        throw new Exception("No content found (possibly blocked by safety filter)");
                    }
                    JSONArray resParts = content.optJSONArray("parts");
                    if (resParts == null || resParts.length() == 0) {
                        throw new Exception("No parts found");
                    }
                    String rawText = resParts.getJSONObject(0).optString("text", "").trim();

                    // Gemini 응답에서 JSON 본문({...}) 부분만 정확하게 추출
                    // startsWith 체크 방식보다 훨씬 안전 (개행/마크다운 펜스 등 무관)
                    int jsonStart = rawText.indexOf('{');
                    int jsonEnd = rawText.lastIndexOf('}');
                    if (jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart) {
                        rawText = rawText.substring(jsonStart, jsonEnd + 1);
                    }

                    // 최종 데이터를 Capacitor 플러그인의 JSObject로 빌드하여 웹뷰에 전달
                    JSONObject resultData = new JSONObject(rawText);
                    JSObject ret = new JSObject();
                    ret.put("name", resultData.optString("name", ""));
                    ret.put("is_food", resultData.optBoolean("is_food", false));

                    call.resolve(ret);
                } catch (Exception parseEx) {
                    Log.e(TAG, "Gemini 응답 파싱 실패 또는 식재료가 아님", parseEx);
                    // 에러가 나거나 JSON이 아닐 경우 "인식 불가" 상태로 웹뷰에 예쁘게 전달
                    JSObject fallback = new JSObject();
                    fallback.put("is_food", false);
                    fallback.put("name", "");
                    call.resolve(fallback);
                }
            } else if (responseCode == 429) {
                Log.e(TAG, "Gemini API 할당량 초과 (코드: " + responseCode + ")");
                call.reject("이달의 AI 스캔 무료 사용량(한도)을 모두 채웠어요. 다음 달에 다시 이용해 주세요! 💚", "API_LIMIT_EXCEEDED");
            } else if (responseCode == 403) {
                Log.e(TAG, "Gemini API 인증 실패 (코드: " + responseCode + ")");
                call.reject("API 인증에 실패했습니다. 관리자에게 문의해 주세요.", "API_AUTH_FAILED");
            } else {
                Log.e(TAG, "Gemini API 오류 발생 (코드: " + responseCode + ")");
                call.reject("AI 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "API_ERROR");
            }
        } catch (Exception e) {
            Log.e(TAG, "Gemini API 연동 중 예외 발생", e);
            call.reject("네트워크 연결 상태를 확인해 주시거나 잠시 후 다시 시도해 주세요.", "NETWORK_ERROR");
        }
    }

    @PluginMethod
    public void captureAndAnalyzeCalorie(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("카메라 사용 권한이 없습니다.");
            return;
        }

        if (imageCapture == null) {
            call.reject("카메라가 준비되지 않았습니다.");
            return;
        }

        if ("YOUR_GEMINI_API_KEY".equals(GEMINI_API_KEY) || GEMINI_API_KEY.isEmpty()) {
            call.reject("Gemini API 키가 설정되지 않았습니다.", "API_KEY_MISSING");
            return;
        }

        imageCapture.takePicture(ContextCompat.getMainExecutor(getActivity()),
                new ImageCapture.OnImageCapturedCallback() {
                    @Override
                    public void onCaptureSuccess(@NonNull ImageProxy image) {
                        cameraExecutor.execute(() -> {
                            try {
                                byte[] jpegBytes = imageToByteArray(image);
                                image.close();
                                byte[] optimizedBytes = resizeImage(jpegBytes, 800);
                                callGeminiAPIForCalorie(optimizedBytes, call);
                            } catch (Exception e) {
                                Log.e(TAG, "칼로리 분석 이미지 처리 실패", e);
                                call.reject("이미지 처리 실패: " + e.getMessage(), "IMAGE_PROCESSING_FAILED");
                            }
                        });
                    }

                    @Override
                    public void onError(@NonNull ImageCaptureException exception) {
                        Log.e(TAG, "칼로리 분석 사진 촬영 실패", exception);
                        call.reject("사진 촬영 실패: " + exception.getMessage(), "CAPTURE_FAILED");
                    }
                });
    }

    @PluginMethod
    public void capturePhoto(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("카메라 사용 권한이 없습니다.");
            return;
        }

        if (imageCapture == null) {
            call.reject("카메라가 준비되지 않았습니다.");
            return;
        }

        imageCapture.takePicture(ContextCompat.getMainExecutor(getActivity()),
                new ImageCapture.OnImageCapturedCallback() {
                    @Override
                    public void onCaptureSuccess(@NonNull ImageProxy image) {
                        cameraExecutor.execute(() -> {
                            try {
                                byte[] jpegBytes = imageToByteArray(image);
                                image.close();
                                byte[] optimizedBytes = resizeImage(jpegBytes, 800);
                                String base64Image = Base64.encodeToString(optimizedBytes, Base64.NO_WRAP);

                                JSObject ret = new JSObject();
                                ret.put("photo", "data:image/jpeg;base64," + base64Image);
                                call.resolve(ret);
                            } catch (Exception e) {
                                Log.e(TAG, "사진 촬영 이미지 처리 실패", e);
                                call.reject("이미지 처리 실패: " + e.getMessage(), "IMAGE_PROCESSING_FAILED");
                            }
                        });
                    }

                    @Override
                    public void onError(@NonNull ImageCaptureException exception) {
                        Log.e(TAG, "사진 촬영 실패", exception);
                        call.reject("사진 촬영 실패: " + exception.getMessage(), "CAPTURE_FAILED");
                    }
                });
    }

    @PluginMethod
    public void analyzeCalorie(PluginCall call) {
        String base64Image = call.getString("photo");
        if (base64Image == null || base64Image.isEmpty()) {
            call.reject("분석할 이미지 데이터가 없습니다.");
            return;
        }

        if ("YOUR_GEMINI_API_KEY".equals(GEMINI_API_KEY) || GEMINI_API_KEY.isEmpty()) {
            call.reject("Gemini API 키가 설정되지 않았습니다.", "API_KEY_MISSING");
            return;
        }

        if (base64Image.startsWith("data:image/jpeg;base64,")) {
            base64Image = base64Image.substring("data:image/jpeg;base64,".length());
        } else if (base64Image.startsWith("data:image/png;base64,")) {
            base64Image = base64Image.substring("data:image/png;base64,".length());
        }

        final String finalBase64 = base64Image;
        cameraExecutor.execute(() -> {
            try {
                byte[] imageBytes = Base64.decode(finalBase64, Base64.DEFAULT);
                callGeminiAPIForCalorie(imageBytes, call);
            } catch (Exception e) {
                Log.e(TAG, "칼로리 분석 API 연동 중 예외 발생", e);
                call.reject("이미지 디코딩 또는 분석 실패: " + e.getMessage(), "NETWORK_ERROR");
            }
        });
    }

    private void callGeminiAPIForCalorie(byte[] imageBytes, PluginCall call) {
        try {
            URL url = new URL(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="
                            + GEMINI_API_KEY);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("X-goog-api-key", GEMINI_API_KEY);
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            String base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP);

            JSONObject payload = new JSONObject();
            JSONArray contents = new JSONArray();
            JSONObject contentObj = new JSONObject();
            JSONArray parts = new JSONArray();

            JSONObject textPart = new JSONObject();
            textPart.put("text", "이 사진 속의 음식을 분석해주세요.\n" +
                    "반드시 다음 JSON 형식으로만 응답해주세요 (백틱 ```json과 같은 마크다운 펜스는 절대 씌우지 말고 오직 순수 JSON 데이터만 반환하세요):\n" +
                    "{\n" +
                    "  \"name\": \"음식 이름 (한국어, 예: 김치볶음밥)\",\n" +
                    "  \"calories\": 총 칼로리 숫자 (정수),\n" +
                    "  \"protein\": 단백질 g 숫자 (정수),\n" +
                    "  \"carbs\": 탄수화물 g 숫자 (정수),\n" +
                    "  \"fat\": 지방 g 숫자 (정수),\n" +
                    "  \"ingredients\": [\n" +
                    "    {\"name\": \"재료명1\", \"calories\": 칼로리숫자},\n" +
                    "    {\"name\": \"재료명2\", \"calories\": 칼로리숫자}\n" +
                    "  ],\n" +
                    "  \"is_food\": true 또는 false (음식이 아닌 사물이나 사람인 경우 false)\n" +
                    "}\n\n" +
                    "주의사항:\n" +
                    "1. ingredients 목록에는 물, 소금, 간장, 고춧가루, 식용유 같은 자잘한 조미료나 기본 양념은 제외하고, 주요 식재료(육류, 채소류, 곡류 등) 위주로 적어주세요.\n" +
                    "2. ingredients 목록에 나열된 모든 개별 재료들의 calories 합계는 반드시 음식 전체의 calories보다 작거나 같아야 합니다. 절대 전체 칼로리를 초과하지 않아야 합니다.");
            parts.put(textPart);

            JSONObject imagePart = new JSONObject();
            JSONObject inlineData = new JSONObject();
            inlineData.put("mimeType", "image/jpeg");
            inlineData.put("data", base64Image);
            imagePart.put("inlineData", inlineData);
            parts.put(imagePart);

            contentObj.put("parts", parts);
            contents.put(contentObj);
            payload.put("contents", contents);

            String jsonPayload = payload.toString();

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"));
                StringBuilder response = new StringBuilder();
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    response.append(responseLine.trim());
                }

                try {
                    JSONObject responseJson = new JSONObject(response.toString());
                    JSONArray candidates = responseJson.optJSONArray("candidates");
                    if (candidates == null || candidates.length() == 0) {
                        throw new Exception("No candidates found");
                    }
                    JSONObject candidate = candidates.getJSONObject(0);
                    JSONObject content = candidate.optJSONObject("content");
                    if (content == null) {
                        throw new Exception("No content found");
                    }
                    JSONArray resParts = content.optJSONArray("parts");
                    if (resParts == null || resParts.length() == 0) {
                        throw new Exception("No parts found");
                    }
                    String rawText = resParts.getJSONObject(0).optString("text", "").trim();

                    int jsonStart = rawText.indexOf('{');
                    int jsonEnd = rawText.lastIndexOf('}');
                    if (jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart) {
                        rawText = rawText.substring(jsonStart, jsonEnd + 1);
                    }

                    JSONObject resultData = new JSONObject(rawText);
                    JSObject ret = new JSObject();
                    ret.put("name", resultData.optString("name", ""));
                    ret.put("is_food", resultData.optBoolean("is_food", false));
                    ret.put("calories", resultData.optInt("calories", 0));
                    ret.put("protein", resultData.optInt("protein", 0));
                    ret.put("carbs", resultData.optInt("carbs", 0));
                    ret.put("fat", resultData.optInt("fat", 0));

                    // 재료 목록 변환
                    JSONArray ingredientsArray = resultData.optJSONArray("ingredients");
                    JSArray jsIngredients = new JSArray();
                    if (ingredientsArray != null) {
                        for (int i = 0; i < ingredientsArray.length(); i++) {
                            JSONObject ingObj = ingredientsArray.optJSONObject(i);
                            if (ingObj != null) {
                                JSObject jsIng = new JSObject();
                                jsIng.put("name", ingObj.optString("name", ""));
                                jsIng.put("calories", ingObj.optInt("calories", 0));
                                jsIngredients.put(jsIng);
                            }
                        }
                    }
                    ret.put("ingredients", jsIngredients);

                    call.resolve(ret);
                } catch (Exception parseEx) {
                    Log.e(TAG, "칼로리 분석 응답 파싱 실패", parseEx);
                    JSObject fallback = new JSObject();
                    fallback.put("is_food", false);
                    fallback.put("name", "");
                    call.resolve(fallback);
                }
            } else if (responseCode == 429) {
                call.reject("이달의 AI 스캔 무료 사용량을 모두 채웠어요. 다음 달에 다시 이용해 주세요! 💚", "API_LIMIT_EXCEEDED");
            } else if (responseCode == 403) {
                call.reject("API 인증에 실패했습니다. 관리자에게 문의해 주세요.", "API_AUTH_FAILED");
            } else {
                call.reject("AI 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "API_ERROR");
            }
        } catch (Exception e) {
            Log.e(TAG, "칼로리 분석 API 연동 중 예외 발생", e);
            call.reject("네트워크 연결 상태를 확인해 주시거나 잠시 후 다시 시도해 주세요.", "NETWORK_ERROR");
        }
    }

    @PluginMethod
    public void getIngredientTipsByName(PluginCall call) {
        String ingredientName = call.getString("ingredientName");
        if (ingredientName == null || ingredientName.trim().isEmpty()) {
            call.reject("식재료 이름이 유효하지 않습니다.");
            return;
        }

        if ("YOUR_GEMINI_API_KEY".equals(GEMINI_API_KEY) || GEMINI_API_KEY.isEmpty()) {
            call.reject("Gemini API 키가 설정되지 않았습니다. FoodScannerPlugin.java 파일 상단의 GEMINI_API_KEY 변수에 발급받으신 키를 입력해 주세요.",
                    "API_KEY_MISSING");
            return;
        }

        cameraExecutor.execute(() -> {
            try {
                callGeminiAPITextOnly(ingredientName.trim(), call);
            } catch (Exception e) {
                Log.e(TAG, "식재료 팁 조회 실패", e);
                call.reject("식재료 정보를 조회하는 데 실패했습니다: " + e.getMessage(), "API_ERROR");
            }
        });
    }

    private void callGeminiAPITextOnly(String name, PluginCall call) {
        try {
            URL url = new URL(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="
                            + GEMINI_API_KEY);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("X-goog-api-key", GEMINI_API_KEY);
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            JSONObject payload = new JSONObject();
            JSONArray contents = new JSONArray();
            JSONObject contentObj = new JSONObject();
            JSONArray parts = new JSONArray();

            JSONObject textPart = new JSONObject();
            textPart.put("text", "대한민국(한국)의 사계절 기후와 수확 시기를 기준으로, 식재료 '" + name + "'의 제철 월과 고르는 방법을 알려주세요.\n" +
                    "반드시 다음 JSON 형식으로만 응답해주세요 (백틱 ```json과 같은 마크다운 펜스는 절대 씌우지 말고 오직 순수 JSON 데이터만 반환하세요):\n" +
                    "{\n" +
                    "  \"selection_tip\": \"신선하고 맛있는 것을 고르는 꿀팁 (2~3문장으로 간결하게)\",\n" +
                    "  \"seasonal_months\": [제철인 월 숫자 배열, 예: 봄나물이면 [3,4,5], 가을버섯이면 [9,10,11]]\n" +
                    "}");
            parts.put(textPart);

            contentObj.put("parts", parts);
            contents.put(contentObj);
            payload.put("contents", contents);

            String jsonPayload = payload.toString();

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"));
                StringBuilder response = new StringBuilder();
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    response.append(responseLine.trim());
                }

                try {
                    JSONObject responseJson = new JSONObject(response.toString());
                    JSONArray candidates = responseJson.optJSONArray("candidates");
                    if (candidates == null || candidates.length() == 0) {
                        throw new Exception("No candidates found");
                    }
                    JSONObject candidate = candidates.getJSONObject(0);
                    JSONObject content = candidate.optJSONObject("content");
                    if (content == null) {
                        throw new Exception("No content found (possibly blocked by safety filter)");
                    }
                    JSONArray resParts = content.optJSONArray("parts");
                    if (resParts == null || resParts.length() == 0) {
                        throw new Exception("No parts found");
                    }
                    String rawText = resParts.getJSONObject(0).optString("text", "").trim();

                    // Gemini 응답에서 JSON 본문({...}) 부분만 정확하게 추출
                    // startsWith 체크 방식보다 훨씬 안전 (개행/마크다운 펜스 등 무관)
                    int jsonStart = rawText.indexOf('{');
                    int jsonEnd = rawText.lastIndexOf('}');
                    if (jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart) {
                        rawText = rawText.substring(jsonStart, jsonEnd + 1);
                    }

                    JSONObject resultData = new JSONObject(rawText);
                    JSObject ret = new JSObject();
                    ret.put("selection_tip", resultData.optString("selection_tip", ""));

                    JSONArray monthsArray = resultData.optJSONArray("seasonal_months");
                    JSArray jsMonths = new JSArray();
                    if (monthsArray != null) {
                        for (int i = 0; i < monthsArray.length(); i++) {
                            jsMonths.put(monthsArray.optInt(i));
                        }
                    }
                    ret.put("seasonal_months", jsMonths);

                    call.resolve(ret);
                } catch (Exception parseEx) {
                    Log.e(TAG, "Gemini 응답 파싱 실패", parseEx);
                    JSObject fallback = new JSObject();
                    fallback.put("selection_tip", "신선하고 고유의 색택이 선명하며 흠집이 없는 것을 고르는 것이 좋습니다.");
                    fallback.put("seasonal_months", new JSArray());
                    call.resolve(fallback);
                }
            } else if (responseCode == 429) {
                Log.e(TAG, "Gemini API 할당량 초과 (코드: " + responseCode + ")");
                call.reject("이달의 AI 스캔 무료 사용량(한도)을 모두 채웠어요. 다음 달에 다시 이용해 주세요! 💚", "API_LIMIT_EXCEEDED");
            } else if (responseCode == 403) {
                Log.e(TAG, "Gemini API 인증 실패 (코드: " + responseCode + ")");
                call.reject("API 인증에 실패했습니다. 관리자에게 문의해 주세요.", "API_AUTH_FAILED");
            } else {
                Log.e(TAG, "Gemini API 오류 발생 (코드: " + responseCode + ")");
                call.reject("AI 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "API_ERROR");
            }
        } catch (Exception e) {
            Log.e(TAG, "Gemini API 연동 중 예외 발생", e);
            call.reject("네트워크 연결 상태를 확인해 주시거나 잠시 후 다시 시도해 주세요.", "NETWORK_ERROR");
        }
    }

    @PluginMethod
    public void stopCamera(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (cameraProvider != null) {
                    cameraProvider.unbindAll();
                }

                if (previewView != null && container != null) {
                    container.removeView(previewView);
                    previewView = null;
                }

                // 웹뷰 배경색 복원
                bridge.getWebView().setBackgroundColor(Color.WHITE);

                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "카메라 정지 실패", e);
                call.reject("카메라를 끄는 중 에러 발생: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (cameraExecutor != null) {
            cameraExecutor.shutdown();
        }
    }
}
