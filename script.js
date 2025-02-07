// Initialize or get existing card requests from localStorage
let cardRequests = JSON.parse(localStorage.getItem('cardRequests') || '[]');

// Function to update the table with card requests
function updateRequestsTable() {
    const tableBody = document.getElementById('requestsTableBody');
    tableBody.innerHTML = '';

    // Add requests to table in reverse order (newest first)
    [...cardRequests].reverse().forEach(request => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${request.date}</td>
            <td>${request.time}</td>
            <td>${request.recipientFirstName || ''}</td>
            <td>${request.recipientLastName || ''}</td>
            <td>${request.isLocal ? 'Yes' : 'No'}</td>
            <td>${request.isNonMember ? 'Yes' : 'No'}</td>
            <td>${request.street || ''}</td>
            <td>${request.zipcode || ''}</td>
            <td>${request.request || ''}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Initialize table when page loads
document.addEventListener('DOMContentLoaded', updateRequestsTable);

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
                    if (lowerLine.includes('to:') || lowerLine.includes('recipient:')) {
                        const name = line.split(':')[1]?.trim() || '';
                        const [firstName = '', lastName = ''] = name.split(' ');
                        document.getElementById('recipientFirstName').value = firstName;
                        document.getElementById('recipientLastName').value = lastName;
                    } else if (lowerLine.includes('address:') || lowerLine.includes('send to:')) {
                        const address = line.split(':')[1]?.trim() || '';
                        const zipMatch = address.match(/\b\d{5}\b/);
                        if (zipMatch) {
                            document.getElementById('zipcode').value = zipMatch[0];
                            document.getElementById('street').value = address.replace(zipMatch[0], '').trim();
                        } else {
                            document.getElementById('street').value = address;
                        }
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
    const recipientFirstName = document.getElementById('recipientFirstName').value;
    const recipientLastName = document.getElementById('recipientLastName').value;
    const street = document.getElementById('street').value;
    const zipcode = document.getElementById('zipcode').value;
    const request = document.getElementById('request').value;
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    // Get checkbox values
    const isLocal = document.getElementById('isLocal').checked;
    const isNonMember = document.getElementById('isNonMember').checked;

    // Validate recipient status
    if (!isLocal || !isNonMember) {
        alert('This form is only for local non-members. For others, please use the prayer request form.');
        return;
    }

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

    // Validate ZIP code format
    const zipRegex = /^\d{5}$/;
    if (!zipRegex.test(zipcode)) {
        alert('Please enter a valid 5-digit ZIP code.');
        document.getElementById('zipcode').focus();
        return;
    }

    // Validate required fields
    if (!recipientFirstName) {
        alert('Please enter the recipient\'s first name.');
        document.getElementById('recipientFirstName').focus();
        return;
    }
    if (!street) {
        alert('Please enter the street address.');
        document.getElementById('street').focus();
        return;
    }

    // Add new request to array
    cardRequests.push({
        date,
        time,
        recipientFirstName,
        recipientLastName,
        isLocal,
        isNonMember,
        street,
        zipcode,
        request,
        photo: photoData
    });

    // Save to localStorage
    localStorage.setItem('cardRequests', JSON.stringify(cardRequests));

    // Update the table
    updateRequestsTable();

    // Show confirmation message
    document.getElementById('cardForm').style.display = 'none';
    document.getElementById('confirmation').classList.remove('hidden');

    // Reset form (will be hidden but ready if we want to show it again)
    event.target.reset();
}

function downloadAllRequests() {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create worksheet data
    const wsData = [
        ['Date', 'Time', 'First Name', 'Last Name', 'Local', 'Non-Member', 'Street Address', 'ZIP Code', 'Message/Instructions', 'Card Photo']
    ];

    // Add requests to worksheet data in reverse order (newest first)
    [...cardRequests].reverse().forEach((request, index) => {
        wsData.push([
            request.date,
            request.time,
            request.recipientFirstName || '',
            request.recipientLastName || '',
            request.isLocal ? 'Yes' : 'No',
            request.isNonMember ? 'Yes' : 'No',
            request.street || '',
            request.zipcode || '',
            request.request || '',
            '' // Photo cell will be handled separately
        ]);

        if (request.photo) {
            // Add image to the photo cell
            const rowIndex = index + 2; // +2 because of header row and 1-based indexing
            const photoCell = XLSX.utils.encode_cell({r: rowIndex-1, c: 9}); // Column J
            
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
        {wch: 20}, // First Name
        {wch: 20}, // Last Name
        {wch: 10}, // Local
        {wch: 12}, // Non-Member
        {wch: 30}, // Street Address
        {wch: 12}, // ZIP Code
        {wch: 40}, // Message
        {wch: 30}  // Photo
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Card Requests');

    // Save workbook
    XLSX.writeFile(wb, 'card_requests.xlsx');
}

function submitAnotherRequest() {
    document.getElementById('cardForm').style.display = 'block';
    document.getElementById('confirmation').classList.add('hidden');
    // Clear photo preview
    const preview = document.getElementById('photoPreview');
    const img = preview.querySelector('img');
    if (img) {
        img.style.display = 'none';
        img.src = '';
    }
    document.getElementById('photo').value = '';
    // Clear checkboxes
    document.getElementById('isLocal').checked = false;
    document.getElementById('isNonMember').checked = false;
}
