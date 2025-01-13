// Initialize or get existing card requests from localStorage
let cardRequests = JSON.parse(localStorage.getItem('cardRequests') || '[]');

// Add photo preview and OCR functionality
document.getElementById('photo').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        const preview = document.getElementById('photoPreview');
        
        // Create or get existing preview image
        let img = preview.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            preview.appendChild(img);
        }

        reader.onload = async function(e) {
            img.src = e.target.result;
            img.style.display = 'block';

            try {
                // Perform OCR on the image
                const result = await Tesseract.recognize(
                    e.target.result,
                    'eng',
                    { logger: m => console.log(m) }
                );

                const text = result.data.text;
                console.log('Extracted text:', text);

                // Parse text for card-specific information
                const lines = text.split('\n').filter(line => line.trim());
                
                // Try to identify and fill in form fields based on the extracted text
                let messageText = '';
                lines.forEach(line => {
                    const lowerLine = line.toLowerCase();
                    if (lowerLine.includes('from:') || lowerLine.includes('sender:')) {
                        document.getElementById('requester').value = line.split(':')[1]?.trim() || '';
                    } else if (lowerLine.includes('to:') || lowerLine.includes('recipient:')) {
                        document.getElementById('receiver').value = line.split(':')[1]?.trim() || '';
                    } else if (lowerLine.includes('address:') || lowerLine.includes('send to:')) {
                        document.getElementById('address').value = line.split(':')[1]?.trim() || '';
                    } else if (lowerLine.includes('message:') || lowerLine.includes('note:')) {
                        messageText = line.split(':')[1]?.trim() || '';
                    } else {
                        messageText += line + '\n';
                    }
                });
                
                document.getElementById('request').value = messageText.trim();
            } catch (error) {
                console.error('OCR Error:', error);
            }
        };

        reader.readAsDataURL(file);
    }
});

async function handleSubmit(event) {
    event.preventDefault();
    
    // Get form values
    const requester = document.getElementById('requester').value;
    const receiver = document.getElementById('receiver').value;
    const address = document.getElementById('address').value;
    const request = document.getElementById('request').value;
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    // Handle photo
    let photoData = null;
    const photoFile = document.getElementById('photo').files[0];
    if (photoFile) {
        photoData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(photoFile);
        });
    }

    // Validate that either photo is uploaded or fields are filled
    if (!photoData && (!requester || !receiver || !address)) {
        alert('Please either upload a card photo or fill in the required fields (sender, recipient, and address).');
        return;
    }

    // Add new request to array
    cardRequests.push({
        date,
        time,
        requester,
        receiver,
        address,
        request,
        photo: photoData
    });

    // Save to localStorage
    localStorage.setItem('cardRequests', JSON.stringify(cardRequests));

    // Show confirmation message
    document.getElementById('prayerForm').style.display = 'none';
    document.getElementById('confirmation').classList.remove('hidden');

    // Reset form (will be hidden but ready if we want to show it again)
    event.target.reset();
}

function downloadAllRequests() {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create worksheet data
    const wsData = [
        ['Date', 'Time', 'Requested By', 'Card Recipient', 'Mailing Address', 'Message/Instructions', 'Card Photo']
    ];

    // Add requests to worksheet data in reverse order (newest first)
    [...cardRequests].reverse().forEach((request, index) => {
        wsData.push([
            request.date,
            request.time,
            request.requester,
            request.receiver,
            request.address,
            request.request,
            '' // Photo cell will be handled separately
        ]);

        if (request.photo) {
            // Add image to the photo cell
            const rowIndex = index + 2; // +2 because of header row and 1-based indexing
            const photoCell = XLSX.utils.encode_cell({r: rowIndex-1, c: 6}); // Column G
            
            // Create drawing object for the image
            if (!wb.Drawings) wb.Drawings = [];
            wb.Drawings.push({
                cell: photoCell,
                path: request.photo,
                type: 'image',
                editAs: 'oneCell'
            });
        }
    });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
        {wch: 12}, // Date
        {wch: 12}, // Time
        {wch: 20}, // Requester
        {wch: 20}, // Receiver
        {wch: 30}, // Address
        {wch: 40}, // Prayer Request
        {wch: 30}  // Photo
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Prayer Requests');

    // Save workbook
    XLSX.writeFile(wb, 'prayer_requests.xlsx');
}

function submitAnotherRequest() {
    document.getElementById('prayerForm').style.display = 'block';
    document.getElementById('confirmation').classList.add('hidden');
    // Clear photo preview
    const preview = document.getElementById('photoPreview');
    const img = preview.querySelector('img');
    if (img) {
        img.style.display = 'none';
        img.src = '';
    }
    document.getElementById('photo').value = '';
}
