// ============== 設定項目 ==============
// ステップ2でコピーした、あなたのGoogle Apps ScriptのウェブアプリURLをここに貼り付けてください
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwp6GIAAnoTMojKWgr7AHZNw5dLdTYG1GLTgsBKVVCMkSHZanVlCS4ieo73SPwVKxW6/exec';
// =====================================

// グローバル変数
let scoreData = [];
let scoreChart = null;
const HIGHLIGHT_COLOR = 'rgba(255, 99, 132, 0.8)';
const BASE_COLOR = 'rgba(54, 162, 235, 0.6)';

// 【新しいコード①】回答済みのユーザー向けにUIを更新する関数
function updateUiForAnsweredUser() {
    const formSection = document.getElementById('score-form');
    const submitButton = formSection.querySelector('button');
    const statusMessage = document.createElement('p'); // 新しくメッセージ用の要素を作成
    
    const savedScore = localStorage.getItem('submittedScore');
    statusMessage.innerHTML = `<strong>あなたは回答済みです（送信スコア: ${savedScore}点）。</strong><br>他の点数の順位を確認することもできます。`;
    
    formSection.prepend(statusMessage); // フォームの前にメッセージを挿入
    submitButton.textContent = 'この点数の順位を確認';
}

// 【新しいコード②】フォームの送信イベントを処理するメインの関数
function handleFormEvent(event) {
    event.preventDefault();
    const scoreInput = document.getElementById('user-score');
    const userScore = parseInt(scoreInput.value, 10);

    if (isNaN(userScore) || userScore < 200 || userScore > 800) {
        alert('200から800の間の整数を入力してください。');
        return;
    }
    
    // 回答済みかどうかで呼び出す関数を切り替える
    if (localStorage.getItem('submittedScore')) {
        // 回答済みなら、順位確認だけを行う
        checkRank(userScore);
    } else {
        // 未回答なら、点数を送信する
        submitScore(userScore);
    }
}

// 【新しいコード③】DOMが読み込まれたら実行するメインの処理
document.addEventListener('DOMContentLoaded', () => {
    // まず、回答済みかどうかをチェックする
    if (localStorage.getItem('submittedScore')) {
        // 回答済みなら、UIを回答済み表示に切り替える
        updateUiForAnsweredUser();
    }

    // フォームの送信イベントを設定する
    const form = document.getElementById('score-form');
    if (form) {
        form.addEventListener('submit', handleFormEvent);
    }

    // 統計データは必ず読み込んで表示する
    fetchDataAndInitialize();
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
// 統計情報を計算して表示する関数（中央値を追加）
function displayStatistics() {
    const count = scoreData.length;
    if (count === 0) return;

    const sum = scoreData.reduce((acc, score) => acc + score, 0);
    const mean = sum / count;

    // --- 中央値の計算を追加 ---
    const sorted = [...scoreData].sort((a, b) => a - b); // 点数を昇順にソート
    const midIndex = Math.floor(count / 2);
    const median = count % 2 !== 0 ? sorted[midIndex] : (sorted[midIndex - 1] + sorted[midIndex]) / 2;
    // --- ここまで追加 ---

    const variance = scoreData.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / count;
    const stdDev = Math.sqrt(variance);

    // DOM要素への書き込み
    document.getElementById('mean').textContent = mean.toFixed(1) + '点';
    document.getElementById('median').textContent = median.toFixed(1) + '点'; // 中央値を表示
    document.getElementById('std-dev').textContent = stdDev.toFixed(1);
    document.getElementById('count').textContent = count + '人';
    document.getElementById('max-score').textContent = Math.max(...scoreData) + '点';
    document.getElementById('min-score').textContent = Math.min(...scoreData) + '点';
}

// ヒストグラムのデータを作成する関数（動的レンジ版）
function createHistogramData() {
    // データが存在しない場合は、空のグラフ情報を返す
    if (scoreData.length === 0) {
        return { labels: [], data: [] };
    }

    const bins = {};
    const binSize = 20; // 20点刻み

    // 1. データの最小値と最大値を取得
    const minScore = Math.min(...scoreData);
    const maxScore = Math.max(...scoreData);

    // 2. グラフの軸の開始点と終了点を計算
    // (例: 最小値が435なら、キリの良い420から開始する)
    const axisStart = Math.floor(minScore / binSize) * binSize;
    
    // 3. 動的な範囲でループ処理を行い、ビンの器を準備
    for (let i = axisStart; i <= maxScore; i += binSize) {
        const binStart = i;
        // ラベルを「440～」のようにシンプルにする
        const label = `${binStart}～`; 
        bins[label] = 0;
    }

    // 各スコアがどのビンに属するかを数える
    scoreData.forEach(score => {
        const binStart = Math.floor(score / binSize) * binSize;
        const label = `${binStart}～`;
        if (bins.hasOwnProperty(label)) {
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
                aspectRatio: 1.5, 
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


// 【新しい関数①】順位確認と結果表示の機能
function checkRank(userScore) {
    // 現在のデータセットで順位を計算・表示
    const tempScoreData = [...scoreData].sort((a, b) => b - a); // 念のためソート
    const totalCount = tempScoreData.length;

    // 順位を計算
    const higherScores = tempScoreData.filter(score => score > userScore).length;
    const rank = higherScores + 1;

    const percentile = (rank / totalCount) * 100;
    const sameScoreCount = tempScoreData.filter(score => score === userScore).length;
    
    let rankText = `${rank}位 / ${totalCount}人中`;
    if (sameScoreCount > 0) {
      rankText += ` (同点${sameScoreCount}人)`;
    }

    // 結果を表示
    document.getElementById('rank-result').innerHTML = `入力した${userScore}点の順位: <span class="highlight-result">${rankText}</span>`;
    document.getElementById('percentile-result').innerHTML = `上位<span class="highlight-result">${percentile.toFixed(1)}%</span>に位置します。`;
    document.getElementById('result-display').style.display = 'block';

    // グラフをハイライト
    const binSize = 20;
    const binStart = Math.floor(userScore / binSize) * binSize;
    const binEnd = binStart + binSize - 1;
    const targetLabel = `${binStart} - ${binEnd}`;
    const histogram = createHistogramData();
    const highlightIndex = histogram.labels.indexOf(targetLabel);
    createOrUpdateChart(highlightIndex); // ← highlightIndexを渡すように変更
}

async function submitScore(userScore) {
    const submitButton = document.querySelector('#score-form button');
    try {
        submitButton.disabled = true;
        submitButton.textContent = '送信中...';

        // データをGASに送信
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ score: userScore }),
        });
        
        // 送信が成功したら、送信した点数をブラウザに記録
        localStorage.setItem('submittedScore', userScore);
        
        // データを再読み込み
        await fetchDataAndInitialize();
        
        // UIを「回答済み」の状態に更新
        updateUiForAnsweredUser();

        // 自分が送信した点数の順位を表示
        checkRank(userScore);

    } catch (error) { // ← catchブロックの始まり
        console.error('送信エラー:', error);
        alert('点数の送信に失敗しました。しばらくしてからもう一度お試しください。');
        // エラーが起きたらボタンを元に戻す
        submitButton.disabled = false;
        submitButton.textContent = '点数を送信して順位を確認';
    } // ← catchブロックの終わり
    // finallyブロックは今回は不要なので削除しました
}
