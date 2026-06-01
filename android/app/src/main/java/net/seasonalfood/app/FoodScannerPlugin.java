package net.seasonalfood.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "FoodScanner",
    permissions = {
        @Permission(
            strings = { Manifest.permission.CAMERA },
            alias = "camera"
        )
    }
)
public class FoodScannerPlugin extends Plugin {
    private static final String TAG = "FoodScannerPlugin";

    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private ExecutorService cameraExecutor;
    private FrameLayout container;
    private ImageLabeler labeler;

    // ML Kit 감지 사전 (웹뷰에 노출되어 매핑 가능한 핵심 라벨 목록)
    private static final Set<String> TARGET_LABELS = new HashSet<>();
    static {
        TARGET_LABELS.add("Apple");
        TARGET_LABELS.add("Banana");
        TARGET_LABELS.add("Tomato");
        TARGET_LABELS.add("Potato");
        TARGET_LABELS.add("Cucumber");
        TARGET_LABELS.add("Carrot");
        TARGET_LABELS.add("Broccoli");
        TARGET_LABELS.add("Pumpkin");
        TARGET_LABELS.add("Strawberry");
        TARGET_LABELS.add("Grape");
        TARGET_LABELS.add("Watermelon");
        TARGET_LABELS.add("Peach");
        TARGET_LABELS.add("Orange");
        TARGET_LABELS.add("Mandarin orange");
        TARGET_LABELS.add("Lemon");
        TARGET_LABELS.add("Citrus");
        TARGET_LABELS.add("Eggplant");
        TARGET_LABELS.add("Corn");
        TARGET_LABELS.add("Garlic");
        TARGET_LABELS.add("Mushroom");
        TARGET_LABELS.add("Edible mushroom");
        TARGET_LABELS.add("Chestnut");
        TARGET_LABELS.add("Fish");
        TARGET_LABELS.add("Seafood");
        TARGET_LABELS.add("Crab");
        TARGET_LABELS.add("Oyster");
        TARGET_LABELS.add("Clam");
        TARGET_LABELS.add("Plum");
    }

    @Override
    public void load() {
        super.load();
        // 분석을 위한 백그라운드 스레드 생성
        cameraExecutor = Executors.newSingleThreadExecutor();
        // ML Kit 이미지 분류기 초기화 (기본 옵션 - 신뢰도 0.5 이상만 1차 통과)
        labeler = ImageLabeling.getClient(new ImageLabelerOptions.Builder()
                .setConfidenceThreshold(0.5f)
                .build());
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

                // 1. 웹뷰 배경 투명화
                bridge.getWebView().setBackgroundColor(Color.TRANSPARENT);

                // 2. 웹뷰의 부모 레이아웃 획득 (FrameLayout)
                container = (FrameLayout) bridge.getWebView().getParent();

                // 3. 네이티브 PreviewView 생성 및 동적 추가
                previewView = new PreviewView(getActivity());
                previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
                
                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                );

                // 웹뷰 바로 아래 레이어(인덱스 0)에 꽂아서 얹음
                container.addView(previewView, 0, params);

                // 4. CameraX 실행
                startCameraX(call);
            } catch (Exception e) {
                Log.e(TAG, "카메라 초기화 실패", e);
                call.reject("카메라 초기화 중 에러가 발생했습니다: " + e.getMessage());
            }
        });
    }

    private void startCameraX(PluginCall call) {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = 
                ProcessCameraProvider.getInstance(getActivity());

        cameraProviderFuture.addListener(() -> {
            try {
                cameraProvider = cameraProviderFuture.get();

                // 프리뷰 설정
                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                // 실시간 이미지 분석 설정
                ImageAnalysis imageAnalysis = new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();

                imageAnalysis.setAnalyzer(cameraExecutor, new ImageAnalysis.Analyzer() {
                    @Override
                    public void analyze(@NonNull ImageProxy imageProxy) {
                        analyzeFrame(imageProxy);
                    }
                });

                // 후면 카메라 기본 선택
                CameraSelector cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA;

                // 기존 바인딩 해제 후 재바인딩
                cameraProvider.unbindAll();
                cameraProvider.bindToLifecycle(
                        getActivity(),
                        cameraSelector,
                        preview,
                        imageAnalysis
                );

                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "CameraX 바인딩 실패", e);
                call.reject("카메라 바인딩 실패: " + e.getMessage());
            }
        }, ContextCompat.getMainExecutor(getActivity()));
    }

    @androidx.annotation.OptIn(markerClass = androidx.camera.core.ExperimentalGetImage.class)
    private void analyzeFrame(ImageProxy imageProxy) {
        if (imageProxy.getImage() == null) {
            imageProxy.close();
            return;
        }

        // ML Kit 전용 InputImage 변환
        InputImage image = InputImage.fromMediaImage(
                imageProxy.getImage(),
                imageProxy.getImageInfo().getRotationDegrees()
        );

        labeler.process(image)
                .addOnSuccessListener(labels -> {
                    processLabels(labels);
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "ML Kit 분석 실패", e);
                })
                .addOnCompleteListener(task -> {
                    // 분석 완료 후 반드시 프레임 클로즈하여 다음 프레임 대기
                    imageProxy.close();
                });
    }

    private void processLabels(List<ImageLabel> labels) {
        for (ImageLabel label : labels) {
            String text = label.getText();
            float confidence = label.getConfidence();

            // 신뢰도가 75% 이상이고, 우리가 인식하고자 하는 핵심 사전(Target)에 해당할 때만 웹뷰로 실시간 전달
            if (confidence >= 0.75f && TARGET_LABELS.contains(text)) {
                JSObject ret = new JSObject();
                ret.put("label", text);
                ret.put("confidence", confidence);
                
                // Capacitor 이벤트 발생
                notifyListeners("foodDetected", ret);
                break; // 한 프레임당 가장 유력한 사물 1개만 전달
            }
        }
    }

    @PluginMethod
    public void stopCamera(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                // CameraX 바인딩 해제
                if (cameraProvider != null) {
                    cameraProvider.unbindAll();
                }

                // 뷰 제거 및 투명 복구
                if (previewView != null && container != null) {
                    container.removeView(previewView);
                    previewView = null;
                }

                // 웹뷰 배경 원래대로 돌림 (하얗게 원복)
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
