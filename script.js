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

// 統計情報を計算して表示する関数
function displayStatistics() {
    const count = scoreData.length;
    if (count === 0) return;

    const sum = scoreData.reduce((acc, score) => acc + score, 0);
    const mean = sum / count;
    
    const sorted = [...scoreData].sort((a, b) => a - b);
    const mid = Math.floor(count / 2);
    const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const stdDev = Math.sqrt(scoreData.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / count);

    document.getElementById('mean').textContent = mean.toFixed(1) + '点';
    document.getElementById('median').textContent = median.toFixed(1) + '点';
    document.getElementById('std-dev').textContent = stdDev.toFixed(1);
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


// フォーム送信時の処理
function handleFormSubmit(event) {
    event.preventDefault(); // フォームのデフォルトの送信動作をキャンセル
    const scoreInput = document.getElementById('user-score');
    const userScore = parseInt(scoreInput.value, 10);

    // 入力値のバリデーション
    if (isNaN(userScore) || userScore < 200 || userScore > 800) {
        alert('200から800の間の整数を入力してください。');
        return;
    }
    
    // 順位を計算 (scoreDataは降順ソート済み)
    // 自分より点数が高い人の数を数え、1を足すと順位になる
    const higherScores = scoreData.filter(score => score > userScore).length;
    const rank = higherScores + 1;

    // 同点の人も考慮
    const sameScoreCount = scoreData.filter(score => score === userScore).length;
    let rankText = `${rank}位 / ${scoreData.length}人中`;
    if (sameScoreCount > 0) {
      rankText += ` (同点${sameScoreCount}人)`;
    }


    // 上位パーセントを計算
    const percentile = (rank / scoreData.length) * 100;
    
    // 結果を表示
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
}
