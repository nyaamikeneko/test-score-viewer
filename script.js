// ============== 設定項目 ==============
// ステップ2でコピーした、あなたのGoogle Apps ScriptのウェブアプリURLをここに貼り付けてください
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwp6GIAAnoTMojKWgr7AHZNw5dLdTYG1GLTgsBKVVCMkSHZanVlCS4ieo73SPwVKxW6/exec';
// =====================================

// グローバル変数
let scoreData = [];
let scoreChart = null;
const HIGHLIGHT_COLOR = 'rgba(255, 99, 132, 0.8)';
const BASE_COLOR = 'rgba(54, 162, 235, 0.6)';


// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
    fetchDataAndInitialize();
    document.getElementById('score-form').addEventListener('submit', handleFormSubmit);
});

// データを取得してページを初期化するメイン関数
async function fetchDataAndInitialize() {
    try {
        const response = await fetch(GAS_URL);
        if (!response.ok) throw new Error('ネットワークの応答が正しくありませんでした。');
        
        const data = await response.json();
        // データを降順（高い点数が上）にソート
        scoreData = data.scores.sort((a, b) => b - a);

        displayStatistics();
        createOrUpdateChart();

    } catch (error) {
        console.error('データの取得に失敗しました:', error);
        alert('データの取得に失敗しました。GASのURLが正しいか、デプロイ設定（アクセス権が「全員」）を確認してください。');
    }
}

// 統計情報を計算して表示する関数（平均点・標準偏差・人数・最大/最小 版）
function displayStatistics() {
    const count = scoreData.length;
    if (count === 0) return; // データがなければ何もしない

    const sum = scoreData.reduce((acc, score) => acc + score, 0);
    const mean = sum / count;

    // 標準偏差の計算
    const variance = scoreData.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / count;
    const stdDev = Math.sqrt(variance);

    // DOM要素への書き込み
    document.getElementById('mean').textContent = mean.toFixed(1) + '点';
    document.getElementById('std-dev').textContent = stdDev.toFixed(1); // 標準偏差を表示
    document.getElementById('count').textContent = count + '人';
    document.getElementById('max-score').textContent = Math.max(...scoreData) + '点';
    document.getElementById('min-score').textContent = Math.min(...scoreData) + '点';
}

// ヒストグラムのデータを作成する関数
function createHistogramData() {
    const bins = {};
    const binSize = 20; // 20点刻みで集計

    for (let i = 200; i <= 800; i += binSize) {
        const binStart = i;
        const binEnd = i + binSize -1;
        const label = `${binStart} - ${binEnd}`;
        bins[label] = 0;
    }

    scoreData.forEach(score => {
        const binStart = Math.floor(score / binSize) * binSize;
        const binEnd = binStart + binSize - 1;
        const label = `${binStart} - ${binEnd}`;
        if(bins.hasOwnProperty(label)) {
            bins[label]++;
        }
    });

    return {
        labels: Object.keys(bins),
        data: Object.values(bins)
    };
}


// グラフを描画または更新する関数
function createOrUpdateChart(highlightIndex = -1) {
    const histogram = createHistogramData();
    const backgroundColors = histogram.labels.map((_, index) => index === highlightIndex ? HIGHLIGHT_COLOR : BASE_COLOR);

    const chartData = {
        labels: histogram.labels,
        datasets: [{
            label: '人数',
            data: histogram.data,
            backgroundColor: backgroundColors,
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }]
    };

    const ctx = document.getElementById('scoreChart').getContext('2d');

    if (scoreChart) {
        // 既存のグラフがあれば更新
        scoreChart.data = chartData;
        scoreChart.update();
    } else {
        // 新規にグラフを作成
        scoreChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '人数' }
                    },
                    x: {
                        title: { display: true, text: '点数' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => `${tooltipItems[0].label}点`,
                            label: (tooltipItem) => `人数: ${tooltipItem.raw}人`
                        }
                    }
                }
            }
        });
    }
}


// フォーム送信時の処理（データ送信機能付き）
async function handleFormSubmit(event) {
    event.preventDefault();
    const scoreInput = document.getElementById('user-score');
    const userScore = parseInt(scoreInput.value, 10);
    const submitButton = document.querySelector('#score-form button');

    // バリデーション
    if (isNaN(userScore) || userScore < 200 || userScore > 800) {
        alert('200から800の間の整数を入力してください。');
        return;
    }

    // --- データ送信処理 ---
    try {
        // 送信中はボタンを無効化し、テキストを変更
        submitButton.disabled = true;
        submitButton.textContent = '送信中...';

        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // no-corsモードで送信
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ score: userScore }),
        });
        
        // no-corsモードではレスポンスの中身を確認できないため、成功したと仮定して進める
        
        // --- データの再読み込みと表示更新 ---
        
        // 最新データを取得して統計とグラフを再描画
        await fetchDataAndInitialize();
        
        // 新しいデータセットで自分の順位を計算・表示
        const tempScoreData = [...scoreData].sort((a, b) => b - a);
        const totalCount = tempScoreData.length;
        const rank = tempScoreData.indexOf(userScore) + 1;
        const percentile = (rank / totalCount) * 100;
        const sameScoreCount = tempScoreData.filter(score => score === userScore).length;
        
        let rankText = `${rank}位 / ${totalCount}人中`;
        if (sameScoreCount > 1) {
            rankText += ` (同点${sameScoreCount}人)`;
        }

        document.getElementById('rank-result').textContent = `あなたの順位: ${rankText}`;
        document.getElementById('percentile-result').textContent = `あなたは上位${percentile.toFixed(1)}%です。`;
        document.getElementById('result-display').style.display = 'block';

        // グラフをハイライト
        const binSize = 20;
        const binStart = Math.floor(userScore / binSize) * binSize;
        const binEnd = binStart + binSize - 1;
        const targetLabel = `${binStart} - ${binEnd}`;
        const histogram = createHistogramData();
        const highlightIndex = histogram.labels.indexOf(targetLabel);
        createOrUpdateChart(highlightIndex);

    } catch (error) {
        console.error('送信エラー:', error);
        alert('点数の送信に失敗しました。しばらくしてからもう一度お試しください。');
    } finally {
        // 処理が終わったらボタンを元に戻す
        submitButton.disabled = false;
        submitButton.textContent = '結果を表示';
    }
}
